const crypto = require('crypto')

// Generate a 6-digit OTP
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString()
}

function hashOTP(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex')
}

module.exports = { generateOTP, hashOTP }