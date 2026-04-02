const Redis = require('ioredis')
const logger = require('../../shared/logger')

let client

async function connectRedis() {
  client = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => Math.min(times * 100, 3000)
  })

  client.on('connect', () => logger.info('Redis connected'))
  client.on('error', (err) => logger.error('Redis error', err))

  return client
}

function getRedis() {
  if (!client) throw new Error('Redis not initialized')
  return client
}

module.exports = { connectRedis, getRedis }