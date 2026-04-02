const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    phone: {
      type: String,
      unique: true,
      sparse: true, // allows multiple nulls
      index: true
    },
    password_hash: {
      type: String,
      select: false // never returned in queries by default
    },
    full_name: { type: String, required: true, trim: true },
    upi_id: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    kyc_status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    is_email_verified: {
      type: Boolean,
      default: false
    },
    is_active: { type: Boolean, default: true }
  },
  { timestamps: true }
)

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password_hash')) return next()
  this.password_hash = await bcrypt.hash(this.password_hash, 12)
  next()
})

// Compare password method
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password_hash)
}

// Auto-generate UPI ID on first save
userSchema.pre('save', function (next) {
  if (!this.upi_id && this.email) {
    const handle = this.email.split('@')[0].replace(/[^a-z0-9]/gi, '')
    this.upi_id = `${handle}@paybyteupi`
  }
  next()
})

module.exports = mongoose.model('User', userSchema)