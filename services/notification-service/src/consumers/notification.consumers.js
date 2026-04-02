const { subscribe } = require('../../shared/rabbitmq')
const {
  sendWelcomeEmail,
  sendPaymentSentEmail,
  sendPaymentReceivedEmail,
  sendCashbackEmail
} = require('../utils/email')
const logger = require('../../shared/logger')


const userCache = new Map()

async function startConsumers() {

  // ─── user.registered → welcome email
  await subscribe(
    'notification.user.registered',
    'user.registered',
    async (data) => {
      logger.info(`Sending welcome email to ${data.email}`)

      // Cache user info for later use
      userCache.set(data.userId, {
        email: data.email,
        full_name: data.full_name
      })

      await sendWelcomeEmail({
        email: data.email,
        full_name: data.full_name
      })
    }
  )

  // ─── transaction.completed → payment alerts 
  await subscribe(
    'notification.transaction.completed',
    'transaction.completed',
    async (data) => {
      logger.info(`Processing transaction.completed for txn ${data.transactionId}`)

      const sender = userCache.get(data.senderUserId)
      const receiver = userCache.get(data.receiverUserId)

      // Send to sender
      if (sender) {
        await sendPaymentSentEmail({
          email: sender.email,
          full_name: sender.full_name,
          amount: data.amount,
          receiverName: receiver?.full_name || data.receiverUserId,
          transactionId: data.transactionId
        })
      }

      // Send to receiver
      if (receiver) {
        await sendPaymentReceivedEmail({
          email: receiver.email,
          full_name: receiver.full_name,
          amount: data.amount,
          senderName: sender?.full_name || data.senderUserId,
          transactionId: data.transactionId
        })
      }

      if (!sender && !receiver) {
        logger.warn(`No cached user info for txn ${data.transactionId} — skipping email`)
      }
    }
  )

  // ─── cashback.eligible → cashback email 
  await subscribe(
    'notification.cashback.eligible',
    'cashback.eligible',
    async (data) => {
      logger.info(`Processing cashback for user ${data.userId}`)

      const user = userCache.get(data.userId)
      if (!user) {
        logger.warn(`No cached info for user ${data.userId} — skipping cashback email`)
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