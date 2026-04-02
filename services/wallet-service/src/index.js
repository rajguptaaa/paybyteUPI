require('dotenv').config()
const app = require('./app')
const { connectDB } = require('./config/db')
const { connectRedis } = require('./config/redis')
const { connectRabbitMQ } = require('../shared/rabbitmq')
const { startConsumers } = require('./consumers/wallet.consumer')
const logger = require('../shared/logger')

const PORT = process.env.WALLET_SERVICE_PORT || 4002

async function waitFor(name, fn, retries = 10, delayMs = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      await fn()
      return
    } catch (err) {
      logger.warn(`${name} not ready, retrying in ${delayMs / 1000}s... (${i + 1}/${retries})`)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
  throw new Error(`${name} never became ready after ${retries} retries`)
}

async function start() {
  try {
    await waitFor('MySQL', connectDB)
    await waitFor('Redis', connectRedis)
    await waitFor('RabbitMQ', connectRabbitMQ)
    await startConsumers()

    // Run migrations inline — no knexfile needed
    const knex = require('knex')({
      client: 'mysql2',
      connection: {
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_ROOT_PASSWORD,
        database: process.env.MYSQL_DATABASE
      },
      migrations: {
        directory: './migrations',
        tableName: 'knex_migrations_wallet'
      }
    })

    await knex.migrate.latest()
    logger.info('Migrations ran successfully')
    await knex.destroy() // close this temp connection — main db uses the pool in config/db.js

    app.listen(PORT, () => {
      logger.info(`Wallet service running on port ${PORT}`)
    })
  } catch (err) {
    logger.error('Failed to start wallet service', err)
    process.exit(1)
  }
}

start()