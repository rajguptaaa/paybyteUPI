const amqp = require('amqplib')
const logger = require('./logger')

let connection = null
let channel = null

const EXCHANGE = 'popupi.events'

async function connectRabbitMQ() {
  const url = `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}`

  connection = await amqp.connect(url)
  channel = await connection.createChannel()

  // Declare a topic exchange — routes messages by routing key pattern
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true })

  logger.info('RabbitMQ connected')

  // Handle unexpected disconnects
  connection.on('error', (err) => {
    logger.error('RabbitMQ connection error', err)
  })

  connection.on('close', () => {
    logger.warn('RabbitMQ connection closed — retrying in 5s')
    setTimeout(connectRabbitMQ, 5000)
  })

  return channel
}

function getChannel() {
  if (!channel) throw new Error('RabbitMQ not initialized')
  return channel
}

// Publish an event
async function publish(routingKey, data) {
  const ch = getChannel()
  const message = Buffer.from(JSON.stringify({
    ...data,
    _meta: {
      routingKey,
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME || 'unknown'
    }
  }))

  ch.publish(EXCHANGE, routingKey, message, {
    persistent: true,        // survives RabbitMQ restart
    contentType: 'application/json'
  })

  logger.info(`Event published: ${routingKey}`)
}

// Subscribe to events
async function subscribe(queueName, routingKey, handler) {
  const ch = getChannel()

  // Declare the queue
  await ch.assertQueue(queueName, {
    durable: true,           // survives RabbitMQ restart
    deadLetterExchange: `${EXCHANGE}.dlx`  // failed messages go here
  })

  // Bind queue to exchange with routing key
  await ch.bindQueue(queueName, EXCHANGE, routingKey)

  // Only process one message at a time per consumer
  ch.prefetch(1)

  ch.consume(queueName, async (msg) => {
    if (!msg) return

    try {
      const data = JSON.parse(msg.content.toString())
      await handler(data)
      ch.ack(msg)            // acknowledge — remove from queue
    } catch (err) {
      logger.error(`Error processing message from ${queueName}`, err)
      ch.nack(msg, false, false) // reject — send to dead letter queue
    }
  })

  logger.info(`Subscribed to ${routingKey} via queue ${queueName}`)
}

module.exports = { connectRabbitMQ, getChannel, publish, subscribe, EXCHANGE }