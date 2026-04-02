const { subscribe } = require('../../shared/rabbitmq')
const walletService = require('../services/wallet.service')
const logger = require('../../shared/logger')

async function startConsumers() {
  // Listen for user.registered event
  await subscribe(
    'wallet.user.registered',  // queue name
    'user.registered',         // routing key
    async (data) => {
      logger.info(`Received user.registered event for ${data.email}`)

      await walletService.createWallet({
        userId: data.userId,
        upi_id: data.upi_id
      })
    }
  )

  logger.info('Wallet consumers started')
}

module.exports = { startConsumers }