const knex = require('knex')
const logger = require('./shared/logger')

let db

function connectDB() {
  db = knex({
    client: 'mysql2',
    connection: {
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_ROOT_PASSWORD, 
      database: process.env.MYSQL_DATABASE
    },
    pool: { min: 2, max: 10 }
  })

  return db.raw('SELECT 1')
    .then(() => logger.info('MySQL connected'))
    .catch(err => { throw err })
}

function getDB() {
  if (!db) throw new Error('Database not initialized')
  return db
}

module.exports = { connectDB, getDB }