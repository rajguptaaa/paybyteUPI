const passport = require('passport')
const authService = require('../services/auth.service')
const { UnauthorizedError } = require('../../shared/errors')

// Protect routes — verify JWT + check blacklist
exports.protect = async (req, res, next) => {
  passport.authenticate('jwt', { session: false }, async (err, user) => {
    if (err || !user) return next(new UnauthorizedError('Invalid or expired token'))

    // Check if token was blacklisted (after logout)
    const token = req.headers.authorization?.split(' ')[1]
    const blacklisted = await authService.isTokenBlacklisted(token)
    if (blacklisted) return next(new UnauthorizedError('Token revoked'))

    req.user = user
    next()
  })(req, res, next)
}

// Role-based access control
exports.restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new UnauthorizedError('Insufficient permissions'))
  }
  next()
}