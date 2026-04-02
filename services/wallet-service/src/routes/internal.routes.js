const express = require('express')
const router = express.Router()
const { getDB } = require('../../src/config/db')
const { getRedis } = require('../../src/config/redis')
const { withLock } = require('../utils/lock')
const { v4: uuidv4 } = require('uuid')
const logger = require('../../shared/logger')

// Internal middleware — only allow requests from within Docker network
const internalOnly = (req, res, next) => {
  const secret = req.headers['x-internal-secret']
  if (secret !== process.env.INTERNAL_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}

// POST /internal/debit
router.post('/debit', internalOnly, async (req, res) => {
  const { userId, amount, transactionId, description } = req.body

  try {
    const db = getDB()
    const wallet = await db('wallets').where({ user_id: userId, is_active: true }).first()
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' })

    const result = await withLock(wallet.id, async () => {
      return db.transaction(async (trx) => {
        const locked = await trx('wallets').where({ id: wallet.id }).forUpdate().first()

        if (parseFloat(locked.balance) < parseFloat(amount)) {
          throw new Error('INSUFFICIENT_FUNDS')
        }

        const newBalance = parseFloat(locked.balance) - parseFloat(amount)

        await trx('wallets').where({ id: wallet.id }).update({
          balance: newBalance,
          updated_at: trx.fn.now()
        })

        await trx('ledger_entries').insert({
          transaction_id: transactionId,
          wallet_id: wallet.id,
          entry_type: 'DEBIT',
          amount: parseFloat(amount),
          balance_after: newBalance,
          description: description || 'Debit'
        })

        // Invalidate cache
        const redis = getRedis()
        await redis.del(`wallet:balance:${userId}`)

        return { newBalance, walletId: wallet.id }
      })
    })

    res.json({ success: true, data: result })
  } catch (err) {
    if (err.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ error: 'INSUFFICIENT_FUNDS' })
    }
    logger.error('Debit failed', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /internal/credit
router.post('/credit', internalOnly, async (req, res) => {
  const { userId, amount, transactionId, description } = req.body

  try {
    const db = getDB()
    const wallet = await db('wallets').where({ user_id: userId, is_active: true }).first()
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' })

    const result = await withLock(wallet.id, async () => {
      return db.transaction(async (trx) => {
        const locked = await trx('wallets').where({ id: wallet.id }).forUpdate().first()
        const newBalance = parseFloat(locked.balance) + parseFloat(amount)

        await trx('wallets').where({ id: wallet.id }).update({
          balance: newBalance,
          updated_at: trx.fn.now()
        })

        await trx('ledger_entries').insert({
          transaction_id: transactionId,
          wallet_id: wallet.id,
          entry_type: 'CREDIT',
          amount: parseFloat(amount),
          balance_after: newBalance,
          description: description || 'Credit'
        })

        const redis = getRedis()
        await redis.del(`wallet:balance:${userId}`)

        return { newBalance, walletId: wallet.id }
      })
    })

    res.json({ success: true, data: result })
  } catch (err) {
    logger.error('Credit failed', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /internal/wallet/:userId
router.get('/wallet/:userId', internalOnly, async (req, res) => {
  try {
    const db = getDB()
    const wallet = await db('wallets')
      .where({ user_id: req.params.userId, is_active: true })
      .first()
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' })
    res.json({ success: true, data: { wallet } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /internal/wallet/upi/:upiId
router.get('/wallet/upi/:upiId', internalOnly, async (req, res) => {
  try {
    const db = getDB()
    const wallet = await db('wallets')
      .where({ upi_id: req.params.upiId, is_active: true })
      .first()
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' })
    res.json({ success: true, data: { wallet } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
