const { getDB } = require('../config/db')
const { getRedis } = require('../config/redis')
const { withLock } = require('../utils/lock')
const { v4: uuidv4 } = require('uuid')
const logger = require('../../shared/logger')

const BALANCE_CACHE_TTL = 60 // seconds

class WalletService {

  // ─── Called by RabbitMQ consumer on user.registered ──────────
  async createWallet({ userId, upi_id }) {
    const db = getDB()

    // Idempotent — don't create twice if event fires twice
    const existing = await db('wallets').where({ user_id: userId }).first()
    if (existing) {
      logger.warn(`Wallet already exists for user ${userId}`)
      return existing
    }

    const [wallet] = await db('wallets')
      .insert({
        id: uuidv4(),
        user_id: userId,
        upi_id: upi_id || `${userId.slice(0, 8)}@paybyteupi`,
        balance: 0.00,
        currency: 'INR',
        is_active: true
      })
      .returning('*')
      // MySQL doesn't support returning — fetch after insert
      .catch(async () => {
        return db('wallets').where({ user_id: userId })
      })

    const created = await db('wallets').where({ user_id: userId }).first()
    logger.info(`Wallet created for user ${userId}`)
    return created
  }

  // ─── Get wallet by userId ─────────────────────────────────────
  async getWallet(userId) {
    const db = getDB()
    const wallet = await db('wallets').where({ user_id: userId, is_active: true }).first()
    if (!wallet) throw new Error('Wallet not found')
    return wallet
  }

  // ─── Get balance (Redis cached) ───────────────────────────────
  async getBalance(userId) {
    const redis = getRedis()
    const cacheKey = `wallet:balance:${userId}`

    // Check cache first
    const cached = await redis.get(cacheKey)
    if (cached !== null) {
      return { balance: parseFloat(cached), source: 'cache' }
    }

    // Cache miss — hit DB
    const wallet = await this.getWallet(userId)

    // Store in cache
    await redis.set(cacheKey, wallet.balance.toString(), 'EX', BALANCE_CACHE_TTL)

    return { balance: parseFloat(wallet.balance), source: 'db' }
  }

  // ─── Add money to wallet ──────────────────────────────────────
  async addMoney({ userId, amount, description = 'Added from bank account' }) {
    if (amount <= 0) throw new Error('Amount must be greater than 0')
    if (amount > 100000) throw new Error('Maximum add money limit is ₹1,00,000')

    const wallet = await this.getWallet(userId)

    // Use distributed lock — prevents concurrent add money operations
    return withLock(wallet.id, async () => {
      const db = getDB()

      // Run inside a MySQL transaction — both updates succeed or both fail
      return db.transaction(async (trx) => {
        // Lock the row for this transaction (SELECT FOR UPDATE)
        const locked = await trx('wallets')
          .where({ id: wallet.id })
          .forUpdate()
          .first()

        const newBalance = parseFloat(locked.balance) + parseFloat(amount)
        const transactionId = uuidv4()

        // Update balance
        await trx('wallets')
          .where({ id: wallet.id })
          .update({
            balance: newBalance,
            updated_at: trx.fn.now()
          })

        // Create ledger entry
        await trx('ledger_entries').insert({
          transaction_id: transactionId,
          wallet_id: wallet.id,
          entry_type: 'CREDIT',
          amount: parseFloat(amount),
          balance_after: newBalance,
          description
        })

        // Invalidate balance cache
        const redis = getRedis()
        await redis.del(`wallet:balance:${userId}`)

        logger.info(`Added ₹${amount} to wallet ${wallet.id}. New balance: ₹${newBalance}`)

        return {
          transactionId,
          amount: parseFloat(amount),
          newBalance,
          message: `₹${amount} added successfully`
        }
      })
    })
  }

  // ─── Get ledger / transaction history ────────────────────────
  async getLedger(userId, { page = 1, limit = 20 } = {}) {
    const db = getDB()
    const wallet = await this.getWallet(userId)

    const offset = (page - 1) * limit

    const entries = await db('ledger_entries')
      .where({ wallet_id: wallet.id })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)

    const [{ total }] = await db('ledger_entries')
      .where({ wallet_id: wallet.id })
      .count('id as total')

    return {
      entries,
      pagination: {
        page,
        limit,
        total: parseInt(total),
        pages: Math.ceil(total / limit)
      }
    }
  }

  // ─── Link bank account ────────────────────────────────────────
  async linkBankAccount({ userId, account_number, ifsc_code, bank_name, account_holder_name }) {
    const db = getDB()

    // Mock verification — in production this calls NPCI/bank API
    const isVerified = await this._mockVerifyBankAccount(account_number, ifsc_code)

    const id = uuidv4()
    await db('bank_accounts').insert({
      id,
      user_id: userId,
      account_number,
      ifsc_code: ifsc_code.toUpperCase(),
      bank_name,
      account_holder_name,
      is_verified: isVerified,
      is_primary: false
    })

    return db('bank_accounts').where({ id }).first()
  }

  async getBankAccounts(userId) {
    const db = getDB()
    return db('bank_accounts').where({ user_id: userId })
  }

  // ─── Mock bank verification ───────────────────────────────────
  async _mockVerifyBankAccount(accountNumber, ifscCode) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))

    // Mock logic — in production call actual bank verification API
    const validIFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)
    const validAccount = accountNumber.length >= 9 && accountNumber.length <= 18

    return validIFSC && validAccount
  }
}

module.exports = new WalletService()