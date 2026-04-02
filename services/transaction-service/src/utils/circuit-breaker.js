const logger = require('../../shared/logger')

const STATES = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' }

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name
    this.state = STATES.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = null

    this.failureThreshold = options.failureThreshold || 3  // open after 3 failures
    this.recoveryTimeout = options.recoveryTimeout || 30000 // try again after 30s
    this.successThreshold = options.successThreshold || 2   // close after 2 successes
  }

  async execute(fn) {
    if (this.state === STATES.OPEN) {
      const timeSinceFailure = Date.now() - this.lastFailureTime

      if (timeSinceFailure > this.recoveryTimeout) {
        logger.info(`Circuit ${this.name} → HALF_OPEN`)
        this.state = STATES.HALF_OPEN
      } else {
        throw new Error(`Circuit breaker OPEN for ${this.name} — service unavailable`)
      }
    }

    try {
      const result = await fn()
      this._onSuccess()
      return result
    } catch (err) {
      this._onFailure()
      throw err
    }
  }

  _onSuccess() {
    this.failureCount = 0
    if (this.state === STATES.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= this.successThreshold) {
        logger.info(`Circuit ${this.name} → CLOSED`)
        this.state = STATES.CLOSED
        this.successCount = 0
      }
    }
  }

  _onFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.failureThreshold || this.state === STATES.HALF_OPEN) {
      logger.warn(`Circuit ${this.name} → OPEN after ${this.failureCount} failures`)
      this.state = STATES.OPEN
      this.successCount = 0
    }
  }

  getState() {
    return { name: this.name, state: this.state, failureCount: this.failureCount }
  }
}

module.exports = CircuitBreaker