const { getRedis } = require('../config/redis')
const logger = require('../../shared/logger')

const LOCK_TTL = 30 // seconds

// Acquire a lock — returns true if got it, false if someone else has it
async function acquireLock(key) {
  const redis = getRedis()
  const lockKey = `lock:wallet:${key}`

  // SET key value NX EX ttl — atomic operation
  // NX = only set if not exists
  const result = await redis.set(lockKey, '1', 'EX', LOCK_TTL, 'NX')
  return result === 'OK'
}

// Release the lock
async function releaseLock(key) {
  const redis = getRedis()
  const lockKey = `lock:wallet:${key}`
  await redis.del(lockKey)
}

// Execute a function with a lock — auto-releases on finish or error
async function withLock(key, fn) {
  const acquired = await acquireLock(key)

  if (!acquired) {
    throw new Error('Wallet is busy — another operation is in progress. Try again.')
  }

  try {
    return await fn()
  } finally {
    await releaseLock(key) // always release, even if fn throws
  }
}

module.exports = { acquireLock, releaseLock, withLock }