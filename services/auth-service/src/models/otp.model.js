const mongoose = require('mongoose')

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true
  },
  otp_hash: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['verify_email', 'forgot_password', 'change_password'],
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  is_used: {
    type: Boolean,
    default: false
  },
  expires_at: {
    type: Date,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
})

// MongoDB auto-deletes documents after expires_at
otpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 })

// Compound index — fast lookup by email + purpose
otpSchema.index({ email: 1, purpose: 1 })

module.exports = mongoose.model('OTP', otpSchema)