const transactionService = require('../services/transaction.service')
const { v4: uuidv4 } = require('uuid')

exports.transfer = async (req, res, next) => {
  try {
    const { receiverIdentifier, identifierType, amount, description } = req.body

    // Client can send idempotency key, or we generate one
    const idempotencyKey = req.headers['x-idempotency-key'] || uuidv4()

    const transaction = await transactionService.transfer({
      senderUserId: req.user.userId,
      receiverIdentifier,
      identifierType,
      amount: parseFloat(amount),
      description,
      idempotencyKey
    })

    res.status(201).json({ success: true, data: { transaction } })
  } catch (err) { next(err) }
}

exports.getHistory = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await transactionService.getHistory(req.user.userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    })
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

exports.getTransaction = async (req, res, next) => {
  try {
    const txn = await transactionService.getTransaction(req.params.id, req.user.userId)
    res.json({ success: true, data: { transaction: txn } })
  } catch (err) { next(err) }
}

exports.getRewards = async (req, res, next) => {
  try {
    const rewards = await transactionService.getRewards(req.user.userId)
    res.json({ success: true, data: { rewards } })
  } catch (err) { next(err) }
}