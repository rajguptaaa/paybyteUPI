# PaybyteUPI — Production-Grade Payment Gateway

A production-ready payment gateway backend built with Node.js microservices — inspired by real-world systems like Razorpay, PhonePe, and Slice. Implements advanced backend engineering patterns including distributed transactions, event-driven architecture, idempotency, and double-entry bookkeeping.

---

## Architecture Overview

```
Client
  │
  ▼
NGINX (port 80) — load balancer + reverse proxy
  │
  ▼
API Gateway (port 4000) — GraphQL + REST proxy + rate limiting
  │
  ├──► Auth Service (port 4001)        MongoDB Atlas
  ├──► Wallet Service (port 4002)      MySQL + Redis
  ├──► Transaction Service (port 4003) MySQL + Redis
  └──► Notification Service (port 4004) RabbitMQ consumer only
         │
         ▼
    RabbitMQ (event bus)
    Redis (cache + distributed locks + sessions)
    MySQL (ACID transactions)
```

### Services

| Service | Port | Database | Responsibility |
|---|---|---|---|
| API Gateway | 4000 | — | GraphQL, REST proxy, rate limiting |
| Auth Service | 4001 | MongoDB Atlas | JWT, OAuth, OTP, RBAC |
| Wallet Service | 4002 | MySQL + Redis | Balance, ledger, bank accounts |
| Transaction Service | 4003 | MySQL + Redis | P2P transfers, idempotency, saga |
| Notification Service | 4004 | — | Email notifications via RabbitMQ |

---

## Tech Stack

### Backend
- **Runtime** — Node.js 20 + Express.js
- **API** — REST (internal) + GraphQL (gateway)
- **Auth** — JWT + Refresh Tokens + Google OAuth 2.0 + OTP via Gmail

### Databases
- **MongoDB Atlas** — Users, sessions, OAuth accounts, OTP records
- **MySQL 8** — Wallets, transactions, ledger entries, rewards
- **Redis 7** — Caching, distributed locks, token blacklisting, sessions

### Infrastructure
- **Docker + Docker Compose** — Full containerization
- **NGINX** — Reverse proxy + load balancer
- **RabbitMQ** — Async event bus between services
- **GitHub Actions** — CI pipeline (validate + build + health checks)

### Key Patterns
- **Saga Pattern** — Distributed transaction management with compensation
- **Idempotency Keys** — Prevents duplicate payments on network retry
- **Double-Entry Bookkeeping** — Every transaction creates two ledger entries
- **Distributed Locks** — Redis locks prevent race conditions on wallet operations
- **Circuit Breaker** — Detects service failures and fails fast
- **Event-Driven Architecture** — Services communicate via RabbitMQ events
- **GraphQL BFF** — API Gateway aggregates multiple services in one query

---

## Getting Started

### Prerequisites

- Docker Desktop
- Node.js 20+
- Git
- MongoDB Atlas account (free tier)
- Gmail account with App Password enabled

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/paybyteUPI.git
cd paybyteUPI
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```bash
# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/paybyte-auth

# JWT Secrets (use long random strings)
JWT_ACCESS_SECRET=your_super_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Gmail App Password (myaccount.google.com → Security → App Passwords)
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx

# Google OAuth (console.cloud.google.com)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# MySQL
MYSQL_ROOT_PASSWORD=your_mysql_password
MYSQL_DATABASE=paybyte_db

# RabbitMQ
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=your_rabbitmq_password

# Redis (leave empty for no password in dev)
REDIS_PASSWORD=

# Internal service secret
INTERNAL_SECRET=your_internal_secret
```

### 3. Start all services

```bash
docker compose up --build
```


### 4. Verify everything is running

```bash
docker compose ps
```

All services should show `Up`:

```
paybyte-nginx-1              Up   0.0.0.0:80->80/tcp
paybyte-api-gateway-1        Up   0.0.0.0:4000->4000/tcp
paybyte-auth-service-1       Up   0.0.0.0:4001->4001/tcp
paybyte-wallet-service-1     Up   0.0.0.0:4002->4002/tcp
paybyte-transaction-service-1 Up  0.0.0.0:4003->4003/tcp
paybyte-notification-service-1 Up
paybyte-mysql-1              Up   0.0.0.0:3306->3306/tcp
paybyte-redis-1              Up   0.0.0.0:6379->6379/tcp
paybyte-rabbitmq-1           Up   0.0.0.0:5672->5672/tcp
```

### 5. Health checks

```bash
curl http://localhost/health           # API Gateway via NGINX
curl http://localhost:4001/health      # Auth Service
curl http://localhost:4002/health      # Wallet Service
curl http://localhost:4003/health      # Transaction Service
```

---

## API Documentation

### Base URL
```
http://localhost/api/v1
```

### Authentication Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Create account + send verification OTP | — |
| POST | `/auth/login` | Login with email/password | — |
| POST | `/auth/refresh` | Refresh access token | Cookie |
| POST | `/auth/logout` | Invalidate refresh token | Cookie |
| GET | `/auth/me` | Get current user profile | Bearer |
| POST | `/auth/verify-email/send` | Send email verification OTP | — |
| POST | `/auth/verify-email/confirm` | Verify email with OTP | — |
| POST | `/auth/forgot-password/send` | Send forgot password OTP | — |
| POST | `/auth/forgot-password/reset` | Reset password with OTP | — |
| POST | `/auth/change-password/send` | Send change password OTP | Bearer |
| POST | `/auth/change-password/confirm` | Change password with OTP | Bearer |
| GET | `/auth/google` | Start Google OAuth flow | — |

### Wallet Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/wallet` | Get wallet details | Bearer |
| GET | `/wallet/balance` | Get balance (Redis cached) | Bearer |
| POST | `/wallet/add-money` | Add money to wallet | Bearer |
| GET | `/wallet/ledger` | Get transaction ledger | Bearer |
| POST | `/wallet/bank-accounts` | Link bank account | Bearer |
| GET | `/wallet/bank-accounts` | Get linked bank accounts | Bearer |

### Transaction Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/transactions/transfer` | Send money via UPI ID | Bearer |
| GET | `/transactions/history` | Get transaction history | Bearer |
| GET | `/transactions/rewards` | Get cashback and rewards | Bearer |
| GET | `/transactions/:id` | Get single transaction | Bearer |

### GraphQL Endpoint

```
POST http://localhost/graphql
Authorization: Bearer <token>
```

**Example query — fetch everything in one request:**

```graphql
query {
  dashboard {
    user {
      email
      upi_id
      kyc_status
    }
    wallet {
      balance
      currency
      upi_id
    }
    recentTransactions {
      amount
      status
      type
      created_at
    }
    rewards {
      type
      amount
      status
    }
  }
}
```

**Available queries:**

```graphql
query { me { ... } }
query { wallet { ... } }
query { balance }
query { dashboard { user wallet recentTransactions rewards } }
query { transactionHistory(page: 1, limit: 20) { transactions pagination } }
query { transaction(id: "uuid") { ... } }
query { rewards { ... } }
```

---

## Key Engineering Decisions

### Idempotency Keys
Every payment request requires an `x-idempotency-key` header. If the same key is sent twice (network retry), the server returns the original result without processing again. This prevents double charges.

```
POST /api/v1/transactions/transfer
x-idempotency-key: unique-uuid-per-payment
```

### Saga Pattern for Distributed Transactions
P2P transfers follow a saga:
1. Create transaction record (PENDING)
2. Debit sender wallet via HTTP → wallet-service
3. Credit receiver wallet via HTTP → wallet-service
4. Mark transaction COMPLETED

If step 3 fails, the saga automatically compensates by re-crediting the sender and marking the transaction FAILED. Money is never lost.

### Double-Entry Bookkeeping
Every money movement creates two ledger entries — a DEBIT on the sender and a CREDIT on the receiver. The sum of all entries always equals zero. This makes financial auditing trivial and bugs impossible to hide.

### Redis Distributed Locks
Before modifying any wallet balance, a Redis lock is acquired using `SET key value NX EX`. This prevents two simultaneous operations from corrupting the same wallet balance. The lock is always released in a `finally` block.

### Circuit Breaker
The transaction service wraps all wallet-service HTTP calls in a circuit breaker. After 3 failures in 60 seconds the circuit opens and requests fail fast without hammering the broken service. After 30 seconds it enters HALF-OPEN and tests recovery.

### Event-Driven Wallet Creation
When a user registers, auth-service publishes a `user.registered` event to RabbitMQ. Wallet-service and notification-service independently consume this event — wallet-service creates a wallet, notification-service sends a welcome email. Services are fully decoupled.

---

## Project Structure

```
paybyteUPI/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI pipeline
├── nginx/
│   └── nginx.conf              # NGINX reverse proxy config
├── services/
│   ├── auth-service/
│   │   ├── src/
│   │   │   ├── config/         # DB, Redis, Passport config
│   │   │   ├── models/         # Mongoose models
│   │   │   ├── routes/         # Express routes
│   │   │   ├── controllers/    # Request handlers
│   │   │   ├── services/       # Business logic
│   │   │   ├── middlewares/    # Auth, validation, error handling
│   │   │   └── utils/          # JWT, OTP, email helpers
│   │   ├── shared/             # Shared logger + errors
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── wallet-service/         # Same structure + migrations/
│   ├── transaction-service/    # Same structure + migrations/
│   ├── notification-service/   # Consumers only, no HTTP server
│   └── api-gateway/            # GraphQL schema + resolvers + proxy
├── shared/                     # Source of truth for shared utilities
│   ├── logger.js
│   ├── errors.js
│   └── rabbitmq.js
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## CI/CD Pipeline

GitHub Actions runs on every push to `main` and every pull request:

```
Job 1: Validate services
  → npm install all services
  → verify dependencies resolve

Job 2: Build Docker images
  → build all 5 service images
  → layer caching with GitHub Actions cache

Job 3: Integration health checks
  → spin up MySQL, Redis, RabbitMQ
  → start all application services
  → curl health check every service
  → verify MySQL tables were created
  → tear down on completion
```

---

## RabbitMQ Management UI

```
http://localhost:15672
Login: RABBITMQ_USER / RABBITMQ_PASSWORD from .env
```

Shows live queue stats, message rates, and consumer connections.

---

## Database Management

**MySQL (via Docker):**
```bash
docker exec -it paybyte-mysql-1 mysql -u root -p
use paybyte_db;
show tables;
select * from wallets;
select * from transactions;
select * from ledger_entries;
```

**Redis:**
```bash
docker exec -it paybyte-redis-1 redis-cli
KEYS *
GET wallet:balance:<userId>
```

**MongoDB Atlas:** Use Atlas web UI → Collections

---

## Environment Variables Reference

| Variable | Service | Description |
|---|---|---|
| `MONGODB_URI` | Auth | MongoDB Atlas connection string |
| `JWT_ACCESS_SECRET` | All | JWT signing secret (access tokens) |
| `JWT_REFRESH_SECRET` | Auth | JWT signing secret (refresh tokens) |
| `JWT_ACCESS_EXPIRES` | All | Access token expiry (default: 15m) |
| `JWT_REFRESH_EXPIRES` | Auth | Refresh token expiry (default: 7d) |
| `GOOGLE_CLIENT_ID` | Auth | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Auth | Google OAuth client secret |
| `SMTP_USER` | Auth, Notif | Gmail address for sending emails |
| `SMTP_PASS` | Auth, Notif | Gmail App Password (16 chars) |
| `MYSQL_HOST` | Wallet, Txn | MySQL host (use `mysql` in Docker) |
| `MYSQL_ROOT_PASSWORD` | Wallet, Txn | MySQL root password |
| `MYSQL_DATABASE` | Wallet, Txn | Database name |
| `REDIS_HOST` | Auth, Wallet, Txn | Redis host (use `redis` in Docker) |
| `REDIS_PASSWORD` | All | Redis password (optional in dev) |
| `RABBITMQ_HOST` | All | RabbitMQ host (use `rabbitmq` in Docker) |
| `RABBITMQ_USER` | All | RabbitMQ username |
| `RABBITMQ_PASSWORD` | All | RabbitMQ password |
| `INTERNAL_SECRET` | Wallet, Txn | Secret for internal service-to-service calls |
| `AUTH_SERVICE_URL` | Gateway, Txn | Auth service URL |
| `WALLET_SERVICE_URL` | Gateway, Txn | Wallet service URL |
| `TRANSACTION_SERVICE_URL` | Gateway | Transaction service URL |

---

## Common Commands

```bash
# Start all services
docker compose up

# Start specific service
docker compose up auth-service redis

# Rebuild after code change
docker compose up --build auth-service

# Force rebuild from scratch
docker compose build --no-cache auth-service

# View logs
docker compose logs -f auth-service

# Stop everything
docker compose down

# Stop and remove volumes (fresh start)
docker compose down -v

# Sync shared utilities to all services
cp -r shared/ services/auth-service/shared/
cp -r shared/ services/wallet-service/shared/
cp -r shared/ services/transaction-service/shared/
cp -r shared/ services/notification-service/shared/
cp -r shared/ services/api-gateway/shared/
```

---

## Author

**Raj Gupta**
Built as a personal project demonstrating production-grade backend engineering patterns.

- GitHub: [@rajguptaaa](https://github.com/rajguptaaa)

---
