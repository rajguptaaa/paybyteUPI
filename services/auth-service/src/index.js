require('dotenv').config()
const app = require('./app')
const connectDB = require('./config/db')
const { connectRedis } = require('./config/redis')
const { connectRabbitMQ } = require('../shared/rabbitmq')
const logger = require('../shared/logger')

const PORT = process.env.AUTH_SERVICE_PORT || 4001

async function waitFor(name, fn, retries = 10, delayMs = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      await fn()
      return
    } catch (err) {
      logger.warn(`${name} not ready, retrying in ${delayMs/1000}s... (${i + 1}/${retries})`)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
  throw new Error(`${name} never became ready after ${retries} retries`)
}

async function start() {
  try {
    await waitFor('MongoDB', connectDB)
    await waitFor('Redis', connectRedis)
    await waitFor('RabbitMQ', connectRabbitMQ)

    app.listen(PORT, () => {
      logger.info(`Auth service running on port ${PORT}`)
    })
  } catch (err) {
    logger.error('Failed to start auth service', err)
    process.exit(1)
  }
}

start()