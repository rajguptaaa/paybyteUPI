const axios = require('axios')
const logger = require('../../shared/logger')

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:4001'
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'http://wallet-service:4002'
const TXN_URL = process.env.TRANSACTION_SERVICE_URL || 'http://transaction-service:4003'

// Helper — forward auth token to internal services
function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

// Helper — safe fetch, returns null on error
async function safeFetch(fn) {
  try {
    return await fn()
  } catch (err) {
    logger.error('GraphQL resolver fetch error', err.message)
    return null
  }
}

function createResolvers(token) {
  return {
    // ─── me ───────────────────────────────────────────────────
    me: async () => {
      return safeFetch(async () => {
        const res = await axios.get(`${AUTH_URL}/api/v1/auth/me`, {
          headers: authHeader(token)
        })
        return res.data.data.user
      })
    },

    // ─── wallet ───────────────────────────────────────────────
    wallet: async () => {
      return safeFetch(async () => {
        const res = await axios.get(`${WALLET_URL}/api/v1/wallet`, {
          headers: authHeader(token)
        })
        return res.data.data.wallet
      })
    },

    // ─── balance ──────────────────────────────────────────────
    balance: async () => {
      return safeFetch(async () => {
        const res = await axios.get(`${WALLET_URL}/api/v1/wallet/balance`, {
          headers: authHeader(token)
        })
        return res.data.data.balance
      })
    },

    // ─── dashboard (fetches everything in parallel) ───────────
    dashboard: async () => {
      const [userRes, walletRes, txnRes, ledgerRes, rewardsRes] = await Promise.allSettled([
        axios.get(`${AUTH_URL}/api/v1/auth/me`, { headers: authHeader(token) }),
        axios.get(`${WALLET_URL}/api/v1/wallet`, { headers: authHeader(token) }),
        axios.get(`${TXN_URL}/api/v1/transactions/history?limit=5`, { headers: authHeader(token) }),
        axios.get(`${WALLET_URL}/api/v1/wallet/ledger?limit=5`, { headers: authHeader(token) }),
        axios.get(`${TXN_URL}/api/v1/transactions/rewards`, { headers: authHeader(token) })
      ])

      return {
        user: userRes.status === 'fulfilled' ? userRes.value.data.data.user : null,
        wallet: walletRes.status === 'fulfilled' ? walletRes.value.data.data.wallet : null,
        recentTransactions: txnRes.status === 'fulfilled' ? txnRes.value.data.data.transactions : [],
        recentLedger: ledgerRes.status === 'fulfilled' ? ledgerRes.value.data.data.entries : [],
        rewards: rewardsRes.status === 'fulfilled' ? rewardsRes.value.data.data.rewards : []
      }
    },

    // ─── transaction history ──────────────────────────────────
    transactionHistory: async ({ page = 1, limit = 20 }) => {
      return safeFetch(async () => {
        const res = await axios.get(
          `${TXN_URL}/api/v1/transactions/history?page=${page}&limit=${limit}`,
          { headers: authHeader(token) }
        )
        return res.data.data
      })
    },

    // ─── single transaction ───────────────────────────────────
    transaction: async ({ id }) => {
      return safeFetch(async () => {
        const res = await axios.get(`${TXN_URL}/api/v1/transactions/${id}`, {
          headers: authHeader(token)
        })
        return res.data.data.transaction
      })
    },

    // ─── rewards ──────────────────────────────────────────────
    rewards: async () => {
      return safeFetch(async () => {
        const res = await axios.get(`${TXN_URL}/api/v1/transactions/rewards`, {
          headers: authHeader(token)
        })
        return res.data.data.rewards
      })
    }
  }
}

module.exports = { createResolvers }