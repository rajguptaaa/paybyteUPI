exports.up = function (knex) {
  return knex.schema.createTable('bank_accounts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'))
    table.string('user_id', 255).notNullable()
    table.string('account_number', 255).notNullable()
    table.string('ifsc_code', 20).notNullable()
    table.string('bank_name', 255).notNullable()
    table.string('account_holder_name', 255).notNullable()
    table.boolean('is_verified').notNullable().defaultTo(false)
    table.boolean('is_primary').notNullable().defaultTo(false)
    table.timestamps(true, true)

    table.index('user_id')
    table.unique(['user_id', 'account_number']) // same account can't be linked twice
  })
}

exports.down = function (knex) {
  return knex.schema.dropTable('bank_accounts')
}