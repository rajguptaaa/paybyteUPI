exports.up = function (knex) {
  return knex.schema
    .createTable('transactions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('(UUID())'))
      table.string('idempotency_key', 255).notNullable().unique()
      table.string('sender_user_id', 255).notNullable()
      table.string('receiver_user_id', 255).notNullable()
      table.decimal('amount', 15, 2).notNullable()
      table.string('currency', 3).defaultTo('INR')
      table.enu('type', [
        'P2P_TRANSFER',
        'ADD_MONEY',
        'REFUND',
        'CASHBACK'
      ]).notNullable()
      table.enu('status', [
        'PENDING',
        'COMPLETED',
        'FAILED',
        'REFUNDED'
      ]).notNullable().defaultTo('PENDING')
      table.enu('payment_method', [
        'UPI_ID',
        'ACCOUNT_NUMBER',
        'QR_CODE',
        'WALLET'
      ]).notNullable()
      table.string('description', 500)
      table.json('metadata')            // extra info — QR data, bank details etc
      table.string('failure_reason', 500)
      table.timestamp('completed_at')
      table.timestamps(true, true)

      table.index('sender_user_id')
      table.index('receiver_user_id')
      table.index('status')
      table.index('created_at')
      table.index('idempotency_key')
    })
    .createTable('rewards', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('(UUID())'))
      table.uuid('transaction_id').notNullable()
      table.string('user_id', 255).notNullable()
      table.enu('type', ['CASHBACK', 'COUPON', 'POINTS']).notNullable()
      table.decimal('amount', 15, 2).defaultTo(0)
      table.string('coupon_code', 50)
      table.enu('status', ['PENDING', 'CREDITED', 'EXPIRED']).defaultTo('PENDING')
      table.timestamp('expires_at')
      table.timestamps(true, true)

      table.index('user_id')
      table.index('transaction_id')
      table.foreign('transaction_id').references('id').inTable('transactions')
    })
}

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('rewards')
    .dropTableIfExists('transactions')
}