const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const RefreshToken = require('../models/refresh-token.model')

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  )
}

async function generateRefreshToken(user, ip, device) {
  // Raw token sent to client
  const rawToken = crypto.randomBytes(64).toString('hex')

  // Store hashed version in DB — if DB leaks, tokens are useless
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex')

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

  await RefreshToken.create({
    user_id: user._id,
    token: hashed,
    ip_address: ip,
    device_info: device,
    expires_at: expiresAt
  })

  return rawToken
}

async function verifyRefreshToken(rawToken) {
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex')

  const stored = await RefreshToken.findOne({
    token: hashed,
    is_revoked: false,
    expires_at: { $gt: new Date() }
  })

  return stored
}

module.exports = { generateAccessToken, generateRefreshToken, verifyRefreshToken }