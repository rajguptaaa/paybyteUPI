exports.up = function (knex) {
  return knex.schema.createTable('ledger_entries', (table) => {
    table.increments('id').primary()
    table.string('transaction_id', 255).notNullable()
    table.uuid('wallet_id').notNullable()
    table.enu('entry_type', ['DEBIT', 'CREDIT']).notNullable()
    table.decimal('amount', 15, 2).notNullable()
    table.decimal('balance_after', 15, 2).notNullable()
    table.string('description', 500)
    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.index('wallet_id')
    table.index('transaction_id')
    table.index('created_at')

    table.foreign('wallet_id').references('id').inTable('wallets')
  })
}

exports.down = function (knex) {
  return knex.schema.dropTable('ledger_entries')
}