const mongoose = require('mongoose')

const refreshTokenSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: { type: String, required: true }, // stored hashed
  device_info: String,
  ip_address: String,
  expires_at: { type: Date, required: true },
  is_revoked: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
})

// TTL index — MongoDB auto-deletes expired tokens
refreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('RefreshToken', refreshTokenSchema)