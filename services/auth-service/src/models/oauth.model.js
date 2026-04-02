const mongoose = require('mongoose')

const oauthSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: { type: String, enum: ['google', 'github'], required: true },
  provider_id: { type: String, required: true },
  email: String,
  access_token: String,
  created_at: { type: Date, default: Date.now }
})

oauthSchema.index({ provider: 1, provider_id: 1 }, { unique: true })

module.exports = mongoose.model('OAuthAccount', oauthSchema)