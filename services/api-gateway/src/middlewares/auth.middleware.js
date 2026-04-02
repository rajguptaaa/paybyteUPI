const jwt = require('jsonwebtoken')

exports.protect = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    req.user = { userId: decoded.sub, email: decoded.email, role: decoded.role }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}