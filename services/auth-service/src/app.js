const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const morgan = require('morgan')
const passport = require('passport')
const configurePassport = require('./config/passport') 
const authRoutes = require('./routes/auth.routes')
const errorHandler = require('./middlewares/error.middleware')


const app = express()

configurePassport() 

app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}))
app.use(morgan('combined'))
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true }))
app.use(passport.initialize())

app.use('/api/v1/auth', authRoutes)
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth' }))
app.use((req, res) => res.status(404).json({ error: 'Route not found' }))
app.use(errorHandler)

module.exports = app