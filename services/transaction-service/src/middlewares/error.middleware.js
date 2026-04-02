const logger = require('../../shared/logger')

module.exports = (err, req, res, next) => {
  logger.error({ message: err.message, stack: err.stack, path: req.path })

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message }
    })
  }

  res.status(500).json({
    success: false,
    error: { code: 'SERVER_ERROR', message: 'Something went wrong' }
  })
}