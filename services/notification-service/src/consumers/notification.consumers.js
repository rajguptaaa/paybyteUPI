const { subscribe } = require('../../shared/rabbitmq')
const {
  sendWelcomeEmail,
  sendPaymentSentEmail,
  sendPaymentReceivedEmail,
  sendCashbackEmail
} = require('../utils/email')
const logger = require('../../shared/logger')
const axios = require('axios')

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:4001'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET

// In-memory cache — survives within one session
const userCache = new Map()

// Fetch user from auth-service if not cached
async function getUser(userId) {
  if (userCache.has(userId)) return userCache.get(userId)

  try {
    const res = await axios.get(`${AUTH_URL}/api/v1/auth/internal/users/${userId}`, {
      headers: { 'x-internal-secret': INTERNAL_SECRET },
      timeout: 5000
    })
    const user = res.data.data.user
    if (user) userCache.set(userId, { email: user.email, full_name: user.full_name })
    return userCache.get(userId)
  } catch (err) {
    logger.error(`Failed to fetch user ${userId} from auth-service`, err.message)
    return null
  }
}

async function startConsumers() {

  // user.registered → cache + welcome email
  await subscribe(
    'notification.user.registered',
    'user.registered',
    async (data) => {
      logger.info(`Sending welcome email to ${data.email}`)
      userCache.set(data.userId, { email: data.email, full_name: data.full_name })
      await sendWelcomeEmail({ email: data.email, full_name: data.full_name })
    }
  )

  // transaction.completed → payment alerts
  await subscribe(
    'notification.transaction.completed',
    'transaction.completed',
    async (data) => {
      logger.info(`Processing transaction.completed for txn ${data.transactionId}`)

      const [sender, receiver] = await Promise.all([
        getUser(data.senderUserId),
        getUser(data.receiverUserId)
      ])

      if (sender) {
        await sendPaymentSentEmail({
          email: sender.email,
          full_name: sender.full_name,
          amount: data.amount,
          receiverName: receiver?.full_name || 'user',
          transactionId: data.transactionId
        })
      } else {
        logger.warn(`Could not find sender ${data.senderUserId} — skipping sent email`)
      }

      if (receiver) {
        await sendPaymentReceivedEmail({
          email: receiver.email,
          full_name: receiver.full_name,
          amount: data.amount,
          senderName: sender?.full_name || 'user',
          transactionId: data.transactionId
        })
      } else {
        logger.warn(`Could not find receiver ${data.receiverUserId} — skipping received email`)
      }
    }
  )

  // cashback.eligible → cashback email
  await subscribe(
    'notification.cashback.eligible',
    'cashback.eligible',
    async (data) => {
      logger.info(`Processing cashback for user ${data.userId}`)
      const user = await getUser(data.userId)

      if (!user) {
        logger.warn(`Could not find user ${data.userId} — skipping cashback email`)
        return
      }

      await sendCashbackEmail({
        email: user.email,
        full_name: user.full_name,
        amount: data.amount,
        transactionId: data.transactionId
      })
    }
  )

  logger.info('All notification consumers started')
}

module.exports = { startConsumers }