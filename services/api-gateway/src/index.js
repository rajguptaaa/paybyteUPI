require('dotenv').config()
const app = require('./app')
const logger = require('../shared/logger')

const PORT = process.env.API_GATEWAY_PORT || 4000

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`)
})