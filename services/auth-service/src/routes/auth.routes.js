const express = require('express')
const passport = require('passport')
const router = express.Router()
const authController = require('../controllers/auth.controller')
const { registerValidation, loginValidation } = require('../middlewares/validate.middleware')
const { protect } = require('../middlewares/auth.middleware')
const rateLimit = require('express-rate-limit')
const {
  register, login, refresh, logout, getProfile,
  googleCallback,
  sendVerificationOTP, verifyEmail,
  sendForgotPasswordOTP, resetPassword,
  sendChangePasswordOTP, changePassword
} = require('../controllers/auth.controller')

// Strict rate limit on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many attempts' } }
})

router.post('/register', authLimiter, registerValidation, authController.register)
router.post('/login', authLimiter, loginValidation, authController.login)
router.post('/refresh', authController.refresh)
router.post('/logout', authController.logout)

// Protected route
router.get('/me', protect, authController.getProfile)

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  authController.googleCallback
)


// ─── Email verification (no auth needed) ─────────────────────
router.post('/verify-email/send', authLimiter, sendVerificationOTP)
router.post('/verify-email/confirm', authLimiter, verifyEmail)

// ─── Forgot password (no auth needed) ────────────────────────
router.post('/forgot-password/send', authLimiter, sendForgotPasswordOTP)
router.post('/forgot-password/reset', authLimiter, resetPassword)

// ─── Change password (auth required) ─────────────────────────
router.post('/change-password/send', protect, sendChangePasswordOTP)
router.post('/change-password/confirm', protect, changePassword)

module.exports = router