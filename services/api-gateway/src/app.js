require('dotenv').config()
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const morgan = require('morgan')
const { graphqlHTTP } = require('express-graphql')
const { createProxyMiddleware } = require('http-proxy-middleware')

const schema = require('./graphql/schema')
const { createResolvers } = require('./graphql/resolvers')
const { globalLimiter, authLimiter } = require('./middlewares/ratelimit.middleware')
const { protect } = require('./middlewares/auth.middleware')
const logger = require('../shared/logger')

const app = express()


app.set('trust proxy', 1)

// Security headers
app.use(helmet({
  contentSecurityPolicy: false // disabled for GraphiQL UI
}))

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}))

app.use(morgan('combined'))
app.use(express.json({ limit: '10kb' }))

// Global rate limit
app.use(globalLimiter)

// ─── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', version: 'v1' })
})

// ─── REST Proxy routes ─────────────────────────────────────────

const proxyOptions = (target) => ({
  target,
  changeOrigin: true,
  proxyTimeout: 30000,

  onProxyReq: (proxyReq, req, res) => {
    if (req.body && Object.keys(req.body).length) {
      const bodyData = JSON.stringify(req.body)

      proxyReq.setHeader('Content-Type', 'application/json')
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))

      proxyReq.write(bodyData)
    }
  },

  onError: (err, req, res) => {
    logger.error(`Proxy error to ${target}`, err.message)
    if (!res.headersSent) {
      res.status(502).json({ error: 'Service unavailable' })
    }
  }
})

// Auth routes — strict rate limit
app.use(
  '/api/v1/auth',
  authLimiter,
  createProxyMiddleware(proxyOptions(
    process.env.AUTH_SERVICE_URL || 'http://auth-service:4001'
  ))
)

// Wallet routes — auth required
app.use(
  '/api/v1/wallet',
  createProxyMiddleware(proxyOptions(
    process.env.WALLET_SERVICE_URL || 'http://wallet-service:4002'
  ))
)

// Transaction routes — auth required
app.use(
  '/api/v1/transactions',
  createProxyMiddleware(proxyOptions(
    process.env.TRANSACTION_SERVICE_URL || 'http://transaction-service:4003'
  ))
)

// ─── GraphQL endpoint ──────────────────────────────────────────
app.use('/graphql', protect, (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]

  graphqlHTTP({
    schema,
    rootValue: createResolvers(token),
    graphiql: process.env.NODE_ENV !== 'production', // UI only in dev
    customFormatErrorFn: (err) => {
      logger.error('GraphQL error', err)
      return { message: err.message }
    }
  })(req, res)
})

// ─── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// ─── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.message)
  res.status(500).json({ error: 'Something went wrong' })
})

module.exports = app