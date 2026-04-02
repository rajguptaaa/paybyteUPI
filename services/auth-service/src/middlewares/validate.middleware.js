const { body } = require('express-validator')

exports.registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('full_name').trim().notEmpty().withMessage('Full name required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone required')
]

exports.loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password required')
]

