const User = require('../models/user.model')
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt')
const { getRedis } = require('../config/redis')
const { UnauthorizedError, ValidationError, AppError } = require('../../shared/errors')
const { publish } = require('../../shared/rabbitmq')
const RefreshToken = require('../models/refresh-token.model')
const crypto = require('crypto')
const OTP = require('../models/otp.model')
const { generateOTP, hashOTP } = require('../utils/otp')
const { sendOTPEmail } = require('../utils/email')

class AuthService {

async register({ email, password, full_name, phone }) {
  const exists = await User.findOne({ email })
  if (exists) throw new ValidationError('Email already registered')

  const user = await User.create({
    email,
    password_hash: password,
    full_name,
    phone
  })

  // Publish event — wallet-service and notification-service will react
  await publish('user.registered', {
    userId: user._id.toString(),
    email: user.email,
    full_name: user.full_name,
    upi_id: user.upi_id
  })

  await this._sendOTP(email, 'verify_email')

  const userObj = user.toObject()
  delete userObj.password_hash

  return { user: userObj, message: 'Account created. Check your email for OTP.' }
}

  async login({ email, password, ip, device }) {
    // Explicitly select password_hash (it's hidden by default)
    const user = await User.findOne({ email }).select('+password_hash')

    if (!user || !user.is_active) {
      throw new UnauthorizedError('Invalid credentials')
    }

    if (!user.password_hash) {
      // User registered via OAuth — no password set
      throw new UnauthorizedError('Please login with Google')
    }

    const valid = await user.comparePassword(password)
    if (!valid) throw new UnauthorizedError('Invalid credentials')

    const accessToken = generateAccessToken(user)
    const refreshToken = await generateRefreshToken(user, ip, device)

    return { accessToken, refreshToken, user: { id: user._id, email: user.email, role: user.role } }
  }

  async refreshTokens({ rawToken, ip, device }) {
    const stored = await verifyRefreshToken(rawToken)
    if (!stored) throw new UnauthorizedError('Invalid or expired refresh token')

    const user = await User.findById(stored.user_id)
    if (!user || !user.is_active) throw new UnauthorizedError('User not found')

    // Rotate — revoke old token, issue new pair
    stored.is_revoked = true
    await stored.save()

    const accessToken = generateAccessToken(user)
    const newRefreshToken = await generateRefreshToken(user, ip, device)

    return { accessToken, refreshToken: newRefreshToken }
  }

  async logout(rawToken) {
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex')
    await RefreshToken.findOneAndUpdate(
      { token: hashed },
      { is_revoked: true }
    )
  }

  async blacklistAccessToken(token, expiresIn) {
    // Store in Redis until the token naturally expires
    const redis = getRedis()
    await redis.set(`blacklist:${token}`, '1', 'EX', expiresIn)
  }

  async isTokenBlacklisted(token) {
    const redis = getRedis()
    return await redis.exists(`blacklist:${token}`)
  }

  async getProfile(userId) {
    const user = await User.findById(userId).select('-password_hash')
    if (!user) throw new UnauthorizedError('User not found')
    return user
  }

  async sendVerificationOTP(email) {
    const user = await User.findOne({ email })
    if (!user) throw new ValidationError('Email not registered')
    if (user.is_email_verified) throw new ValidationError('Email already verified')

    await this._sendOTP(email, 'verify_email')
    return { message: 'Verification OTP sent to your email' }
  }

  async verifyEmail({ email, otp }) {
    await this._verifyOTP(email, otp, 'verify_email')

    await User.findOneAndUpdate(
      { email },
      { is_email_verified: true }
    )

    return { message: 'Email verified successfully' }
  }

   async sendForgotPasswordOTP(email) {
    const user = await User.findOne({ email })
    // Don't reveal if email exists or not — security best practice
    if (!user) return { message: 'If this email exists, an OTP has been sent' }

    await this._sendOTP(email, 'forgot_password')
    return { message: 'If this email exists, an OTP has been sent' }
  }

  async resetPassword({ email, otp, newPassword }) {
    await this._verifyOTP(email, otp, 'forgot_password')

    const user = await User.findOne({ email })
    if (!user) throw new ValidationError('User not found')

    user.password_hash = newPassword // pre-save hook hashes it
    await user.save()

    // Revoke all existing refresh tokens for security
    await RefreshToken.updateMany(
      { user_id: user._id },
      { is_revoked: true }
    )

    return { message: 'Password reset successfully. Please login again.' }
  }

  async sendChangePasswordOTP(userId) {
    const user = await User.findById(userId)
    if (!user) throw new UnauthorizedError('User not found')

    await this._sendOTP(user.email, 'change_password')
    return { message: 'OTP sent to your registered email' }
  }

  async changePassword({ userId, otp, newPassword }) {
    const user = await User.findById(userId)
    if (!user) throw new UnauthorizedError('User not found')

    await this._verifyOTP(user.email, otp, 'change_password')

    user.password_hash = newPassword
    await user.save()

    // Revoke all refresh tokens — forces re-login on all devices
    await RefreshToken.updateMany(
      { user_id: userId },
      { is_revoked: true }
    )

    return { message: 'Password changed successfully. Please login again.' }
  }


  async _sendOTP(email, purpose) {
    // Invalidate any existing unused OTP for same email+purpose
    await OTP.deleteMany({ email, purpose, is_used: false })

    const otp = generateOTP()
    const otp_hash = hashOTP(otp)

    const expires_at = new Date()
    expires_at.setMinutes(expires_at.getMinutes() + 10) // 10 min expiry

    await OTP.create({ email, otp_hash, purpose, expires_at })

    await sendOTPEmail({ to: email, otp, purpose })

    return otp // only returned in tests, never sent to client
  }

  async _verifyOTP(email, otp, purpose) {
    const record = await OTP.findOne({
      email,
      purpose,
      is_used: false,
      expires_at: { $gt: new Date() }
    })

    if (!record) throw new ValidationError('OTP expired or not found')

    // Increment attempts — prevent brute force
    record.attempts += 1
    await record.save()

    if (record.attempts > 3) {
      await OTP.deleteOne({ _id: record._id })
      throw new ValidationError('Too many wrong attempts. Request a new OTP.')
    }

    const hashed = hashOTP(otp)
    if (hashed !== record.otp_hash) {
      throw new ValidationError(`Invalid OTP. ${3 - record.attempts} attempts remaining.`)
    }

    // Mark as used
    record.is_used = true
    await record.save()
  }
}

module.exports = new AuthService()