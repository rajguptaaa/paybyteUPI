const rateLimit = require('express-rate-limit')

// Global rate limit — all requests
exports.globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests — slow down' },
  standardHeaders: true,
  legacyHeaders: false
})

// Strict limit for auth endpoints
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts' }
})

// Transfer limit
exports.transferLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many transfer attempts' }
})