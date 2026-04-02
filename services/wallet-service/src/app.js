require('dotenv').config()
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const morgan = require('morgan')
const walletRoutes = require('./routes/wallet.routes')
const errorHandler = require('./middlewares/error.middleware')
const internalRoutes = require('./routes/internal.routes')

const app = express()

app.use(helmet())
app.use(cors())
app.use(morgan('combined'))
app.use(express.json({ limit: '10kb' }))

app.use('/api/v1/wallet', walletRoutes)
app.use('/internal', internalRoutes)
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'wallet' }))
app.use((req, res) => res.status(404).json({ error: 'Route not found' }))
app.use(errorHandler)

module.exports = app