const authService = require('../services/auth.service')
const { validationResult } = require('express-validator')
const { ValidationError } = require('../../shared/errors')
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt')

// Helper to extract client info
const getClientInfo = (req) => ({
  ip: req.ip || req.headers['x-forwarded-for'],
  device: req.headers['user-agent'] || 'unknown'
})

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) throw new ValidationError(errors.array()[0].msg)

    const user = await authService.register(req.body)

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user }
    })
  } catch (err) {
    next(err)
  }
}

exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) throw new ValidationError(errors.array()[0].msg)

    const { ip, device } = getClientInfo(req)
    const result = await authService.login({ ...req.body, ip, device })

    // Refresh token goes in httpOnly cookie — never in response body
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user
      }
    })
  } catch (err) {
    next(err)
  }
}

exports.refresh = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken
    if (!rawToken) throw new UnauthorizedError('No refresh token')

    const { ip, device } = getClientInfo(req)
    const result = await authService.refreshTokens({ rawToken, ip, device })

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    })

    res.json({ success: true, data: { accessToken: result.accessToken } })
  } catch (err) {
    next(err)
  }
}

exports.logout = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken
    if (rawToken) await authService.logout(rawToken)

    res.clearCookie('refreshToken')
    res.json({ success: true, message: 'Logged out successfully' })
  } catch (err) {
    next(err)
  }
}

exports.googleCallback = async (req, res, next) => {
  try {
    // req.user is set by passport after Google OAuth
    const { ip, device } = getClientInfo(req)
    const accessToken = generateAccessToken(req.user)
    const refreshToken = await generateRefreshToken(req.user, ip, device)

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    })

    // Redirect to frontend with access token in query param
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${accessToken}`)
  } catch (err) {
    next(err)
  }
}

exports.getProfile = async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.user._id)
    res.json({ success: true, data: { user } })
  } catch (err) {
    next(err)
  }
}

exports.sendVerificationOTP = async (req, res, next) => {
  try {
    const result = await authService.sendVerificationOTP(req.body.email)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
}

exports.verifyEmail = async (req, res, next) => {
  try {
    const result = await authService.verifyEmail(req.body)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
}

exports.sendForgotPasswordOTP = async (req, res, next) => {
  try {
    const result = await authService.sendForgotPasswordOTP(req.body.email)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
}

exports.resetPassword = async (req, res, next) => {
  try {
    const result = await authService.resetPassword(req.body)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
}


exports.sendChangePasswordOTP = async (req, res, next) => {
  try {
    const result = await authService.sendChangePasswordOTP(req.user._id)
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
}

exports.changePassword = async (req, res, next) => {
  try {
    const result = await authService.changePassword({
      userId: req.user._id,
      otp: req.body.otp,
      newPassword: req.body.newPassword
    })
    res.json({ success: true, ...result })
  } catch (err) { next(err) }
}