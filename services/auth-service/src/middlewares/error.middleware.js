const logger = require('../../shared/logger')

module.exports = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  })

  // Known operational errors (our AppError subclasses)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message
      }
    })
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message }
    })
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]
    return res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_ERROR', message: `${field} already exists` }
    })
  }

  // Unknown errors — don't leak internals
  res.status(500).json({
    success: false,
    error: { code: 'SERVER_ERROR', message: 'Something went wrong' }
  })
}