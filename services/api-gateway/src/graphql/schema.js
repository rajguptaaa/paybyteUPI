const { buildSchema } = require('graphql')

const schema = buildSchema(`
  type User {
    id: ID!
    email: String!
    full_name: String!
    upi_id: String
    role: String!
    kyc_status: String!
    is_email_verified: Boolean!
    created_at: String!
  }

  type Wallet {
    id: ID!
    user_id: String!
    balance: Float!
    currency: String!
    upi_id: String!
    is_active: Boolean!
  }

  type Transaction {
    id: ID!
    sender_user_id: String!
    receiver_user_id: String!
    amount: Float!
    type: String!
    status: String!
    payment_method: String!
    description: String
    created_at: String!
  }

  type LedgerEntry {
    id: ID!
    entry_type: String!
    amount: Float!
    balance_after: Float!
    description: String
    created_at: String!
  }

  type Reward {
    id: ID!
    type: String!
    amount: Float!
    status: String!
    created_at: String!
  }

  type Dashboard {
    user: User
    wallet: Wallet
    recentTransactions: [Transaction]
    recentLedger: [LedgerEntry]
    rewards: [Reward]
  }

  type Pagination {
    page: Int!
    limit: Int!
    total: Int!
    pages: Int!
  }

  type TransactionHistory {
    transactions: [Transaction]
    pagination: Pagination
  }

  type Query {
    me: User
    wallet: Wallet
    balance: Float
    dashboard: Dashboard
    transactionHistory(page: Int, limit: Int): TransactionHistory
    transaction(id: ID!): Transaction
    rewards: [Reward]
  }
`)

module.exports = schema