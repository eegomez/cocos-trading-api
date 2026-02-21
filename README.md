# Cocos Trading API 📈

A production-ready **Trading Portfolio Management API** that provides comprehensive portfolio tracking, order execution, and real-time market data access.

Built with modern technologies and best practices, this API handles everything from portfolio calculations to order management with enterprise-grade reliability and monitoring.

---

## ✨ Features

- 📊 **Portfolio Management** - Real-time portfolio tracking with positions, returns, and cash balances
- 💰 **Order Execution** - MARKET and LIMIT orders with comprehensive validation
- 🔍 **Instrument Search** - Fast search by ticker symbol or company name
- 🔐 **Transaction Safety** - ACID-compliant database transactions
- 📈 **Financial Precision** - Accurate decimal arithmetic for all monetary calculations
- 🚨 **Production Monitoring** - Prometheus + Grafana + Loki stack with pre-configured dashboards
- 🛡️ **Security** - Rate limiting, input validation, and SQL injection prevention
- 🧪 **Comprehensive Testing** - 80%+ test coverage with unit and integration tests

---

## 🚀 Quick Start

### Docker (Recommended)

Get up and running in 60 seconds:

```bash
# Start all services (API + Database + Monitoring)
docker-compose up -d

# Access the API
curl http://localhost:3000/api/health
```

**That's it!** Your API is running with:
- Trading API: http://localhost:3000
- Grafana Dashboard: http://localhost:3001 (admin/admin)
- API Documentation: http://localhost:3000/api-docs

### Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Initialize database
createdb cocos_trading
psql -d cocos_trading -f database/database.sql

# 4. Start development server
npm run dev
```

---

## 🔌 API Endpoints

### Portfolio Management

```bash
# Get user portfolio with positions and returns
GET /api/v1/users/:userId/portfolio
```

### Order Management

```bash
# Create a new order
POST /api/v1/orders

# Get order details
GET /api/v1/orders/:orderId

# Get user order history (paginated)
GET /api/v1/users/:userId/orders

# Cancel pending order
PATCH /api/v1/orders/:orderId/cancel
```

### Instruments

```bash
# Search instruments by ticker or name
GET /api/v1/instruments/search?q=AAPL
```

### System

```bash
# Health check
GET /api/health

# Prometheus metrics
GET /api/metrics
```

**👉 See [api-examples.http](./api-examples.http) for complete API examples with curl commands**

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20+ |
| **Language** | TypeScript (strict mode) |
| **Framework** | Express.js |
| **Database** | PostgreSQL 15 |
| **Validation** | Zod |
| **Testing** | Jest + Supertest |
| **Monitoring** | Prometheus + Grafana + Loki |
| **Logging** | Pino |

---

## 📊 Trading Features

### Order Types

**MARKET Orders**
- Execute immediately at current market price
- Instant confirmation (status: `FILLED` or `REJECTED`)

**LIMIT Orders**
- Execute when target price is reached
- Pending until conditions are met (status: `NEW`)
- Can be cancelled before execution

### Cash Operations

- **CASH_IN** - Deposit funds into account
- **CASH_OUT** - Withdraw funds from account
- Real-time balance validation

### Portfolio Tracking

- Real-time position tracking
- Total return and daily return calculations
- Average buy price computation
- Cash availability tracking

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage report
npm test -- --coverage

# Watch mode for development
npm run test:watch

# Integration tests only
npm run test:integration
```

**Current Coverage:** 80%+ across all layers (services, repositories, API endpoints)

---

## 📊 Monitoring & Observability

The project includes a complete monitoring stack accessible via Docker Compose:

### Grafana Dashboards
- HTTP request metrics (rate, latency, errors)
- Database query performance
- System resources (CPU, memory)
- Real-time log aggregation

**Access:** http://localhost:3001 (admin/admin)

### Prometheus Metrics
- Custom business metrics
- HTTP endpoint performance
- Database connection pooling

**Access:** http://localhost:9090

### Structured Logging
- JSON-formatted logs with Pino
- CloudWatch integration for AWS deployments
- Request/response correlation IDs

---

## 🔧 Configuration

Environment variables are validated at startup for fail-fast behavior:

```bash
# Server
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cocos_trading
DB_USER=postgres
DB_PASSWORD=postgres

# Logging
LOG_LEVEL=info
LOG_PRETTY=true
```

**📄 See `.env.example` for complete configuration options**

---

## 🏗️ Project Structure

```
backend-cocos/
├── src/
│   ├── api/              # Routes and middlewares
│   ├── controllers/      # HTTP request handlers
│   ├── services/         # Business logic
│   ├── repositories/     # Data access layer
│   ├── models/           # TypeScript interfaces
│   ├── validators/       # Input validation schemas
│   └── adapters/         # External integrations
├── database/
│   └── database.sql      # Schema and sample data
├── monitoring/           # Grafana, Prometheus, Loki configs
└── api-examples.http     # API testing examples
```

---

## 📚 Documentation

- **[DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md)** - Comprehensive guide for developers (architecture, design decisions, patterns)
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Deployment instructions for Docker and AWS
- **[OpenAPI Specification](./docs/openapi.yaml)** - API schema for code generation and testing
- **[api-examples.http](./api-examples.http)** - Complete API examples with curl commands

---

## 🔒 Security

- ✅ Rate limiting (100 req/min global, 30 req/min for orders)
- ✅ Helmet security headers
- ✅ Request body size limits
- ✅ SQL injection prevention (parameterized queries)
- ✅ Input validation with runtime type checking
- ✅ Sensitive data redaction in logs

**⚠️ Note:** Authentication is not implemented. Add JWT/session-based auth before production use.

---

## 🚢 Deployment

### Docker (Local/Staging)

```bash
docker-compose up -d
```

### AWS (Production)

The API supports AWS deployment with CloudWatch integration:
- EC2 or ECS for compute
- RDS PostgreSQL for database
- CloudWatch for logs and metrics

**📖 See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed AWS setup instructions**

---


## 👤 Author

**Erik Gomez**

---