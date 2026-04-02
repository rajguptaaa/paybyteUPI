const express = require('express')
const router = express.Router()
const walletController = require('../controllers/wallet.controller')
const { protect } = require('../middlewares/auth.middleware')

// All wallet routes require authentication
router.use(protect)

router.get('/', walletController.getWallet)
router.get('/balance', walletController.getBalance)
router.post('/add-money', walletController.addMoney)
router.get('/ledger', walletController.getLedger)
router.post('/bank-accounts', walletController.linkBankAccount)
router.get('/bank-accounts', walletController.getBankAccounts)

module.exports = router