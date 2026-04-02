exports.up = function (knex) {
  return knex.schema.createTable('wallets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'))
    table.string('user_id', 255).notNullable().unique() // from auth-service
    table.decimal('balance', 15, 2).notNullable().defaultTo(0.00)
    table.string('currency', 3).notNullable().defaultTo('INR')
    table.string('upi_id', 255).notNullable().unique()
    table.boolean('is_active').notNullable().defaultTo(true)
    table.timestamps(true, true)

    table.index('user_id')
    table.index('upi_id')
  })
}

exports.down = function (knex) {
  return knex.schema.dropTable('wallets')
}