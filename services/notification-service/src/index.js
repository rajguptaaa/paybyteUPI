require('dotenv').config()
const { connectRabbitMQ } = require('../shared/rabbitmq')
const { startConsumers } = require('./consumers/notification.consumers')
const logger = require('../shared/logger')

async function waitFor(name, fn, retries = 10, delayMs = 3000) {
  for (let i = 0; i < retries; i++) {
    try { await fn(); return }
    catch (err) {
      logger.warn(`${name} not ready, retrying in ${delayMs / 1000}s... (${i + 1}/${retries})`)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
  throw new Error(`${name} never became ready`)
}

async function start() {
  try {
    await waitFor('RabbitMQ', connectRabbitMQ)
    await startConsumers()
    logger.info('Notification service running')
  } catch (err) {
    logger.error('Failed to start notification service', err)
    process.exit(1)
  }
}

start()