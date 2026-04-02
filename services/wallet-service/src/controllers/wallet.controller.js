const walletService = require('../services/wallet.service')

exports.getWallet = async (req, res, next) => {
  try {
    const wallet = await walletService.getWallet(req.user.userId)
    res.json({ success: true, data: { wallet } })
  } catch (err) { next(err) }
}

exports.getBalance = async (req, res, next) => {
  try {
    const result = await walletService.getBalance(req.user.userId)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

exports.addMoney = async (req, res, next) => {
  try {
    const { amount, description } = req.body
    const result = await walletService.addMoney({
      userId: req.user.userId,
      amount: parseFloat(amount),
      description
    })
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

exports.getLedger = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await walletService.getLedger(req.user.userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    })
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

exports.linkBankAccount = async (req, res, next) => {
  try {
    const account = await walletService.linkBankAccount({
      userId: req.user.userId,
      ...req.body
    })
    res.json({ success: true, data: { account } })
  } catch (err) { next(err) }
}

exports.getBankAccounts = async (req, res, next) => {
  try {
    const accounts = await walletService.getBankAccounts(req.user.userId)
    res.json({ success: true, data: { accounts } })
  } catch (err) { next(err) }
}