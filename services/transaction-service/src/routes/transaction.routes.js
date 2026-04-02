const express = require('express')
const router = express.Router()
const txnController = require('../controllers/transaction.controller')
const { protect } = require('../middlewares/auth.middleware')
const { body } = require('express-validator')
const rateLimit = require('express-rate-limit')

const transferLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many transfer attempts' }
})

const transferValidation = [
  body('receiverIdentifier').notEmpty().withMessage('Receiver required'),
  body('identifierType').isIn(['UPI_ID', 'USER_ID']).withMessage('Invalid identifier type'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least ₹1'),
]

router.use(protect)

router.post('/transfer', transferLimiter, transferValidation, txnController.transfer)
router.get('/history', txnController.getHistory)
router.get('/rewards', txnController.getRewards)
router.get('/:id', txnController.getTransaction)

module.exports = router