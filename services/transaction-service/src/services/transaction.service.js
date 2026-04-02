const { getDB } = require('../config/db')
const { getRedis } = require('../config/redis')
const { publish } = require('../../shared/rabbitmq')
const walletClient = require('../utils/wallet.client')
const { v4: uuidv4 } = require('uuid')
const logger = require('../../shared/logger')

class TransactionService {

  // ─── P2P Transfer ─────────────────────────────────────────────
  async transfer({ senderUserId, receiverIdentifier, identifierType, amount, description, idempotencyKey }) {
    const db = getDB()

    // Step 1 — Idempotency check
    const existing = await db('transactions')
      .where({ idempotency_key: idempotencyKey })
      .first()

    if (existing) {
      logger.info(`Idempotent request — returning existing txn ${existing.id}`)
      return existing
    }

    // Step 2 — Validate
    if (amount <= 0) throw new Error('Amount must be greater than 0')
    if (amount > 100000) throw new Error('Transfer limit is ₹1,00,000 per transaction')

    // Step 3 — Resolve receiver wallet
    let receiverWallet
    if (identifierType === 'UPI_ID') {
      receiverWallet = await walletClient.getWalletByUpiId(receiverIdentifier)
    } else if (identifierType === 'USER_ID') {
      receiverWallet = await walletClient.getWalletByUserId(receiverIdentifier)
    } else {
      throw new Error('Invalid identifier type')
    }

    if (!receiverWallet) throw new Error('Receiver wallet not found')
    if (receiverWallet.user_id === senderUserId) throw new Error('Cannot transfer to yourself')

    // Step 4 — Create transaction record (PENDING)
    const transactionId = uuidv4()

    await db('transactions').insert({
      id: transactionId,
      idempotency_key: idempotencyKey,
      sender_user_id: senderUserId,
      receiver_user_id: receiverWallet.user_id,
      amount: parseFloat(amount),
      type: 'P2P_TRANSFER',
      status: 'PENDING',
      payment_method: identifierType === 'UPI_ID' ? 'UPI_ID' : 'WALLET',
      description: description || `Transfer to ${receiverIdentifier}`,
      metadata: JSON.stringify({ receiverIdentifier, identifierType })
    })

    // Step 5 — Debit sender (Saga step 1)
    try {
      await walletClient.debitWallet({
        userId: senderUserId,
        amount,
        transactionId,
        description: `Transfer to ${receiverIdentifier}`
      })
    } catch (err) {
      // Saga rollback — debit failed, mark transaction failed
      await db('transactions').where({ id: transactionId }).update({
        status: 'FAILED',
        failure_reason: err.response?.data?.error || err.message
      })

      if (err.response?.data?.error === 'INSUFFICIENT_FUNDS') {
        throw new Error('Insufficient wallet balance')
      }
      throw new Error('Payment failed — please try again')
    }

    // Step 6 — Credit receiver (Saga step 2)
    try {
      await walletClient.creditWallet({
        userId: receiverWallet.user_id,
        amount,
        transactionId,
        description: `Received from ${senderUserId}`
      })
    } catch (err) {
      // Saga compensation — credit failed, re-credit sender
      logger.error(`Credit failed for txn ${transactionId} — compensating`, err)

      try {
        await walletClient.creditWallet({
          userId: senderUserId,
          amount,
          transactionId: `${transactionId}_refund`,
          description: 'Refund — transfer failed'
        })
      } catch (compensationErr) {
        // Compensation also failed — this needs manual intervention
        logger.error(`CRITICAL: Compensation failed for txn ${transactionId}`, compensationErr)
      }

      await db('transactions').where({ id: transactionId }).update({
        status: 'FAILED',
        failure_reason: 'Credit to receiver failed — amount refunded'
      })

      throw new Error('Transfer failed — amount has been refunded')
    }

    // Step 7 — Mark completed
    await db('transactions').where({ id: transactionId }).update({
      status: 'COMPLETED',
      completed_at: db.fn.now()
    })

    const transaction = await db('transactions').where({ id: transactionId }).first()

    // Step 8 — Emit events (async — don't block response)
    this._emitTransactionEvents(transaction, receiverWallet).catch(err =>
      logger.error('Failed to emit transaction events', err)
    )

    return transaction
  }

  // ─── Get transaction history ──────────────────────────────────
  async getHistory(userId, { page = 1, limit = 20 } = {}) {
    const db = getDB()
    const offset = (page - 1) * limit

    const transactions = await db('transactions')
      .where('sender_user_id', userId)
      .orWhere('receiver_user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)

    const [{ total }] = await db('transactions')
      .where('sender_user_id', userId)
      .orWhere('receiver_user_id', userId)
      .count('id as total')

    return {
      transactions,
      pagination: {
        page,
        limit,
        total: parseInt(total),
        pages: Math.ceil(total / limit)
      }
    }
  }

  // ─── Get single transaction ───────────────────────────────────
  async getTransaction(transactionId, userId) {
    const db = getDB()
    const txn = await db('transactions')
      .where({ id: transactionId })
      .where(function () {
        this.where('sender_user_id', userId).orWhere('receiver_user_id', userId)
      })
      .first()

    if (!txn) throw new Error('Transaction not found')
    return txn
  }

  // ─── Get rewards ──────────────────────────────────────────────
  async getRewards(userId) {
    const db = getDB()
    return db('rewards').where({ user_id: userId }).orderBy('created_at', 'desc')
  }

  // ─── Private: emit events ─────────────────────────────────────
  async _emitTransactionEvents(transaction, receiverWallet) {
    await publish('transaction.completed', {
      transactionId: transaction.id,
      senderUserId: transaction.sender_user_id,
      receiverUserId: transaction.receiver_user_id,
      amount: transaction.amount,
      type: transaction.type
    })

    // Check cashback eligibility — 2% cashback on every transfer
    const cashbackAmount = parseFloat(
      (parseFloat(transaction.amount) * 0.02).toFixed(2)
    )

    if (cashbackAmount >= 1) {
      await publish('cashback.eligible', {
        transactionId: transaction.id,
        userId: transaction.sender_user_id,
        amount: cashbackAmount
      })
    }
  }
}

module.exports = new TransactionService()