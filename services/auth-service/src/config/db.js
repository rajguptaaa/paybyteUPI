const mongoose = require('mongoose')
const logger = require('../../shared/logger')

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    logger.info('MongoDB Atlas connected')
  } catch (err) {
    logger.error('MongoDB connection failed', err)
    throw err
  }
}

module.exports = connectDB