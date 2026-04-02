const jwt = require('jsonwebtoken')
const { UnauthorizedError } = require('../../shared/errors')

exports.protect = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) throw new UnauthorizedError('No token provided')

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    req.user = { userId: decoded.sub, email: decoded.email, role: decoded.role }
    next()
  } catch (err) {
    if (err.name === 'JsonWebTokenError') return next(new UnauthorizedError('Invalid token'))
    if (err.name === 'TokenExpiredError') return next(new UnauthorizedError('Token expired'))
    next(err)
  }
}