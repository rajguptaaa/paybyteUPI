const axios = require('axios')
const CircuitBreaker = require('./circuit-breaker')
const logger = require('../../shared/logger')

const WALLET_URL = process.env.WALLET_SERVICE_URL || 'http://wallet-service:4002'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET

const breaker = new CircuitBreaker('wallet-service', {
  failureThreshold: 3,
  recoveryTimeout: 30000
})

const internalHeaders = {
  'x-internal-secret': INTERNAL_SECRET,
  'Content-Type': 'application/json'
}

async function getWalletByUserId(userId) {
  return breaker.execute(async () => {
    const res = await axios.get(
      `${WALLET_URL}/internal/wallet/${userId}`,
      { headers: internalHeaders, timeout: 5000 }
    )
    return res.data.data.wallet
  })
}

async function getWalletByUpiId(upiId) {
  return breaker.execute(async () => {
    const res = await axios.get(
      `${WALLET_URL}/internal/wallet/upi/${upiId}`,
      { headers: internalHeaders, timeout: 5000 }
    )
    return res.data.data.wallet
  })
}

async function debitWallet({ userId, amount, transactionId, description }) {
  return breaker.execute(async () => {
    const res = await axios.post(
      `${WALLET_URL}/internal/debit`,
      { userId, amount, transactionId, description },
      { headers: internalHeaders, timeout: 5000 }
    )
    return res.data.data
  })
}

async function creditWallet({ userId, amount, transactionId, description }) {
  return breaker.execute(async () => {
    const res = await axios.post(
      `${WALLET_URL}/internal/credit`,
      { userId, amount, transactionId, description },
      { headers: internalHeaders, timeout: 5000 }
    )
    return res.data.data
  })
}

module.exports = { getWalletByUserId, getWalletByUpiId, debitWallet, creditWallet }