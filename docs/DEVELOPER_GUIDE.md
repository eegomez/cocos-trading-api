# Developer Guide: Cocos Trading API

Complete guide for developers working on the Cocos Trading portfolio management API.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Architecture](#project-architecture)
3. [Technology Stack](#technology-stack)
4. [Critical Concepts & Design Decisions](#critical-concepts--design-decisions)
5. [Common Patterns](#common-patterns)
6. [How to Navigate the Codebase](#how-to-navigate-the-codebase)
7. [Testing Strategy](#testing-strategy)
8. [Environment Variables](#environment-variables)
9. [FAQ](#faq)

---

## Quick Start

### Prerequisites

**Option 1: Docker (Recommended)**
- Docker Desktop ([Download](https://www.docker.com/products/docker-desktop))

**Option 2: Manual Setup**
- Node.js 20+ ([Download](https://nodejs.org/))
- PostgreSQL 14+ ([Download](https://www.postgresql.org/download/))

### Running Locally

**With Docker:**
```bash
# Start all services (API + Database + Monitoring)
docker-compose up -d

# Access:
# - API:     http://localhost:3000
# - Grafana: http://localhost:3001 (admin/admin)
```

**Without Docker:**
```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Create and initialize database
createdb cocos_trading
psql -d cocos_trading -f database/database.sql

# Run development server
npm run dev
```

### API Endpoints

- `GET /api/health` - Health check
- `GET /api/v1/users/:userId/portfolio` - User portfolio
- `GET /api/v1/instruments/search?q=query` - Search stocks
- `POST /api/v1/orders` - Create order
- `GET /api/v1/orders/:orderId` - Get order details
- `GET /api/v1/users/:userId/orders` - Get user orders
- `PATCH /api/v1/orders/:orderId/cancel` - Cancel order
- `GET /api-docs` - Swagger documentation

---

## Project Architecture

This application follows **Layered Architecture** principles with clear separation of concerns:

```
src/
├── api/
│   ├── routes/          # HTTP routing
│   └── middlewares/     # Request processing (metrics, validation)
├── controllers/         # HTTP request/response handlers
├── services/            # Business logic layer
├── repositories/        # Data access layer (SQL queries)
├── validators/          # Input validation schemas (Zod)
├── models/              # TypeScript interfaces
├── adapters/            # External integrations (logging, metrics)
├── config/              # Configuration (database, env)
├── constants/           # Application constants
├── errors/              # Custom error classes
└── utils/               # Helper functions
```

### Request Flow

```
HTTP Request
    ↓
1. Middleware (logging, rate limiting, metrics)
    ↓
2. Router (/api/v1/orders)
    ↓
3. Controller (orders.controller.ts)
    ├─ Validate input (Zod)
    ↓
4. Service (order.service.ts)
    ├─ Business logic
    ├─ Transaction management
    ↓
5. Repository (order.repository.ts)
    ├─ SQL queries
    ↓
6. PostgreSQL Database
    ↓
7. Response back through layers
```

---

## Technology Stack

### Core Technologies

**Node.js**
- JavaScript runtime with event-driven, non-blocking I/O
- Version: 20+
- Chosen for performance and ecosystem maturity

**TypeScript**
- Superset of JavaScript with static typing
- Compile-time type safety
- Strict mode enabled for maximum safety

**Express.js**
- Minimal, unopinionated web framework
- Middleware-based architecture
- Industry standard for Node.js APIs

**PostgreSQL**
- Relational database with strong ACID guarantees
- Version: 15
- Direct SQL queries (no ORM) for full control

### Key Libraries

**pg (node-postgres)**
- PostgreSQL client with connection pooling
- Parameterized queries for SQL injection prevention
- Transaction support

**Zod**
- Runtime validation and type inference
- Schema-based validation
- Type-safe error handling

**Decimal.js**
- Arbitrary-precision decimal arithmetic
- Critical for financial calculations
- Prevents floating-point errors

**Pino**
- High-performance structured logging
- JSON output for easy parsing
- Minimal performance overhead

**Jest**
- Testing framework with built-in mocking
- Coverage reporting
- Parallel test execution

**Prometheus + Grafana + Loki**
- Metrics collection and visualization
- Log aggregation
- Auto-provisioned dashboards

---

## Critical Concepts & Design Decisions

### 1. Database Connection Pooling

**Implementation:** `src/config/database.ts`

```typescript
const pool = new Pool({
  max: 20,                      // Maximum connections
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast if pool is exhausted
  maxUses: 7500,                // Recycle connections after 7500 uses
});
```

**Why:** Reuses database connections instead of creating new ones per request, dramatically improving performance and reducing database load.

### 2. Database Transactions with Isolation

**Implementation:** `src/config/database.ts` - `transaction()` function

```typescript
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

**Why:** Ensures atomicity for order execution (validation + creation happen together or not at all). `READ COMMITTED` isolation prevents dirty reads while maintaining good performance.

### 3. Race Condition Prevention (FOR UPDATE)

**Problem:** Two concurrent orders could both check the same cash balance and both succeed, allowing overspending.

**Solution:** Use `FOR UPDATE` locks within transactions:

```typescript
// Lock rows before aggregating
SELECT SUM(...) FROM (
  SELECT * FROM orders
  WHERE userid = $1 AND status = 'FILLED'
  FOR UPDATE
) orders
```

**Why:** PostgreSQL locks the selected rows, preventing concurrent transactions from reading the same data until the first transaction completes.

**File:** `src/repositories/order.repository.ts` - `getUserAvailableCash()`, `getUserPositionForInstrument()`

### 4. Financial Precision with Decimal.js

**Problem:** JavaScript's `Number` type uses floating-point arithmetic, causing precision errors:
```javascript
0.1 + 0.2 = 0.30000000000000004  // ❌
```

**Solution:** Use `Decimal.js` for all monetary calculations:

```typescript
const totalCost = new Decimal(position.totalCost)
  .plus(new Decimal(order.size).times(order.price));
```

**PostgreSQL Integration:**
- Store monetary values as `NUMERIC` type (exact precision)
- Return as strings from database
- Convert to `Decimal` for calculations
- Only convert to `number` at presentation layer

**Files:** `src/services/order.service.ts`, `src/services/portfolio.service.ts`

### 5. N+1 Query Prevention

**Problem:** Loading portfolio with 20 stocks = 1 query for positions + 20 queries for instrument details.

**Solution:** Batch fetch instruments in single query:

```typescript
// ❌ BAD: N+1 queries
for (const instrumentId of instrumentIds) {
  const instrument = await findInstrumentById(instrumentId);
}

// ✅ GOOD: Single query
const instruments = await findInstrumentsByIds(instrumentIds);
```

**Files:** `src/repositories/instrument.repository.ts` - `findInstrumentsByIds()`, `src/services/portfolio.service.ts`

### 6. Rate Limiting

**Implementation:** `src/middlewares/rateLimiter.ts`

- **Global:** 100 requests/minute per IP
- **Orders:** 20 requests/minute per IP (prevents flash trading abuse)
- **Search:** 50 requests/minute per IP (expensive DB queries)

**Why:** Prevents API abuse, DoS attacks, and ensures fair resource usage.

### 7. Security Headers (Helmet)

**Implementation:** `src/app.ts` - `app.use(helmet())`

Automatically sets secure HTTP headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Content-Security-Policy`
- And more

**Why:** Protects against common web vulnerabilities (XSS, clickjacking, etc.).

### 8. Sensitive Data Sanitization in Logs

**Problem:** Request bodies (with prices, amounts) were logged on every error, exposing user trading activity.

**Solution:** Redact sensitive fields before logging:

```typescript
function sanitizeRequestBody(body: any) {
  const sensitiveFields = ['price', 'amount', 'size'];
  // Redact these fields in logs
}
```

**Why:** Protects user privacy and prevents insider trading (developers shouldn't see user positions).

**File:** `src/middlewares/errorHandler.ts`

### 9. Raw SQL Instead of ORM

**Decision:** Use direct SQL queries with `pg` library instead of an ORM (TypeORM, Prisma, Sequelize).

**Why:**
- **Full control** over complex financial queries
- **Transparency** - see exactly what SQL runs
- **Performance** - no hidden query generation
- **Simpler** - no ORM learning curve or abstraction leaks
- TypeScript interfaces provide type safety

**Trade-off:** Manual SQL writing, but worth it for financial systems where query correctness is critical.

### 10. Repository Pattern

**Why:** Separates SQL from business logic, making code easier to test and maintain.

```typescript
// Repository: SQL queries only
export async function getUserAvailableCash(userId: number) {
  return await query('SELECT SUM(...) FROM orders WHERE userid = $1', [userId]);
}

// Service: Business logic
async function executeOrder(input) {
  const cash = await orderRepo.getUserAvailableCash(input.userId);
  if (cash < orderCost) {
    return createRejectedOrder();
  }
}
```

### 11. Dependency Injection via Constructors

**Implementation:** `src/config/dependencies.ts`

Services receive dependencies through constructors (not direct imports):

```typescript
export class OrderService {
  constructor(
    private orderRepo: IOrderRepository,
    private userRepo: IUserRepository,
    // ...
  ) {}
}

// Instantiate with real implementations
export const orderService = new OrderService(
  orderRepository,
  userRepository,
  // ...
);
```

**Why:** Makes services testable (inject mocks), follows SOLID principles, enables swapping implementations.

### 12. Adapter Pattern for Cross-Environment Support

**Implementation:** `src/adapters/logging/`, `src/adapters/metrics/`

Logging and metrics switch based on environment:

```typescript
// Local: Console + Prometheus
LOGGER_TYPE=console
METRICS_TYPE=noop

// AWS: CloudWatch
LOGGER_TYPE=cloudwatch
METRICS_TYPE=cloudwatch
```

**Why:** Same codebase works in development (Docker) and production (AWS) without code changes.

### 13. Type-Safe Environment Variables

**Implementation:** `src/config/env.ts` - Uses `envalid` library

Environment variables are validated at startup with type safety and defaults:

```typescript
import { cleanEnv, str, num, bool } from 'envalid';

export const env = cleanEnv(process.env, {
  // Server config with strict choices
  NODE_ENV: str({
    choices: ['development', 'test', 'production'],
    default: 'development',
  }),
  PORT: num({ default: 3000 }),

  // Database config with descriptions
  DB_HOST: str({
    default: 'localhost',
    example: 'mydb.us-east-1.rds.amazonaws.com',
  }),
  DB_PORT: num({ default: 5432 }),
  DB_NAME: str({ default: 'cocos_trading' }),
  DB_USER: str({ default: 'postgres' }),
  DB_PASSWORD: str({ default: 'postgres' }),

  // Logging with enum validation
  LOG_LEVEL: str({
    choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
    default: 'info',
  }),
  LOG_PRETTY: bool({ default: true }),

  // AWS CloudWatch (optional)
  AWS_REGION: str({ default: 'us-east-1' }),
  CLOUDWATCH_LOG_GROUP: str({ default: '/aws/cocos-trading/api' }),
  // ...
});

// Type-safe access throughout the app
console.log(env.DB_PORT);  // TypeScript knows this is a number
```

**Why:**
- Fails fast on startup if required vars are missing/invalid
- Prevents runtime errors from misconfiguration
- TypeScript type inference for free (`env.PORT` is `number`, not `string`)
- Self-documenting with descriptions and examples

### 14. Cursor-Based Pagination

**Implementation:** `src/repositories/order.repository.ts` - `getOrdersByUserId()`

```typescript
// ❌ BAD: Offset pagination scans rows
SELECT ... OFFSET 10000 LIMIT 50  // Scans 10,000 rows!

// ✅ GOOD: Cursor pagination uses index
SELECT ... WHERE datetime < $cursor LIMIT 50  // Uses index!
```

**Why:** Fast at any depth, consistent results even when new orders are added.

### 15. Middleware Pipeline Architecture

**Implementation:** `src/app.ts`

```typescript
app.use(helmet());              // Security headers
app.use(rateLimiter);          // Rate limiting
app.use(express.json());       // Parse JSON
app.use(requestLogger);        // Log requests
app.use(metricsMiddleware);    // Track metrics
app.use('/api', apiRoutes);    // Route handlers
app.use(errorHandler);         // Catch errors
```

**Why:** Separation of concerns, reusable request processing, easy to add/remove features.

---

### Future Improvements

The following features are planned for future development:

#### 1. **Authentication & Authorization**
- Implement JWT-based authentication
- Add role-based access control (RBAC)
- Middleware: `v1Router.use(authMiddleware)`
- Protect endpoints by user ownership

#### 2. **LIMIT Order Cash/Share Reservation**
Currently, LIMIT orders don't reserve cash (BUY) or shares (SELL) when created - they only validate on execution. This allows:
- User to create multiple LIMIT BUY orders totaling more than their cash balance
- User to create multiple LIMIT SELL orders for more shares than they own
- Potential overselling if multiple LIMIT orders execute simultaneously

**Solution:** Reserve cash/shares when LIMIT order is created (status `NEW`), release on cancellation or execution.

#### 3. **Database Indexes**
Add indexes for performance optimization:
```sql
-- Composite index for portfolio queries
CREATE INDEX idx_orders_user_status ON orders(userid, status);

-- Index for order lookups
CREATE INDEX idx_orders_datetime ON orders(datetime DESC);

-- Covering index for instrument searches
CREATE INDEX idx_instruments_search ON instruments USING GIN(
  to_tsvector('spanish', ticker || ' ' || name)
);
```

#### 4. **WebSocket Real-Time Updates**
- Push portfolio updates to clients
- Real-time price feeds
- Order status notifications

#### 5. **Caching Layer**
- Redis for frequently accessed data (market prices, user portfolios)
- Reduce database load
- Improve response times

---

## Common Patterns

### 1. Async/Await Error Handling

```typescript
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  logger.error({ error }, 'Operation failed');
  throw error;  // Re-throw to be caught by error handler
}
```

### 2. Controller Error Propagation

```typescript
export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await orderService.executeOrder(req.body);
    res.status(201).json({ success: true, order });
  } catch (error) {
    next(error);  // Pass to global error handler
  }
}
```

### 3. Custom Error Classes

```typescript
// Define errors with status codes
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

// Use them
if (!user) {
  throw new NotFoundError('User not found');
}

// Error handler automatically maps to HTTP responses
```

### 4. Parameterized Queries (SQL Injection Prevention)

```typescript
// ✅ GOOD: Parameterized
await query('SELECT * FROM users WHERE id = $1', [userId]);

// ❌ BAD: String concatenation (SQL injection risk!)
await query(`SELECT * FROM users WHERE id = ${userId}`);
```

### 5. TypeScript Path Aliases

```typescript
// Instead of:
import { query } from '../../../config/database';

// We use:
import { query } from '@/config/database';

// Configured in tsconfig.json
```

### 6. Repository Transaction Support

```typescript
// Repositories accept optional client for transactions
async function createOrder(orderData: {...}, client?: PoolClient) {
  const queryFn = client ? client.query.bind(client) : query;
  return await queryFn('INSERT INTO orders ...', params);
}

// Usage in transaction
await transaction(async (client) => {
  const cash = await getUserAvailableCash(userId, client);
  await createOrder(orderData, client);
});
```

---

## How to Navigate the Codebase

### Start Here (Recommended Order)

**1. Database Schema** (`database/database.sql`)

Understand the data model first:
- `users` - User accounts
- `instruments` - Stocks and currencies (AAPL, ARS, etc.)
- `orders` - All orders (BUY, SELL, CASH_IN, CASH_OUT)
- `marketdata` - Stock prices by date

**2. Models** (`src/models/`)

TypeScript interfaces defining data structures:
```typescript
interface Order {
  id: number;
  userId: number;
  instrumentId: number;
  side: 'BUY' | 'SELL' | 'CASH_IN' | 'CASH_OUT';
  type: 'MARKET' | 'LIMIT';
  size: number;
  price: string;  // NUMERIC from PostgreSQL
  status: 'NEW' | 'FILLED' | 'REJECTED' | 'CANCELLED';
  datetime: Date;
}
```

**3. Routes** (`src/api/routes/`)

See all available API endpoints and their HTTP methods.

**4. Controllers** (`src/controllers/`)

HTTP request handling - validate input, call services, return JSON.

**5. Services** (`src/services/`) ⭐ **Most Important**

**Business logic lives here.** Key files:

**`order.service.ts`** - Core order execution logic
- `executeOrder()` - Main function (handles MARKET vs LIMIT, validation, rejection)
- `cancelOrder()` - Order cancellation logic

**`portfolio.service.ts`** - Portfolio calculations
- `getUserPortfolio()` - Aggregates positions, calculates returns
- Complex but well-commented

**`instrument.service.ts`** - Instrument search
- `searchInstruments()` - Stock search implementation

**6. Repositories** (`src/repositories/`)

Raw SQL queries:

**`order.repository.ts`** - Order data access
- `createOrder()` - INSERT order
- `getUserAvailableCash()` - Complex SUM query with FOR UPDATE
- `getUserPositionForInstrument()` - Calculate net shares

**`instrument.repository.ts`** - Instrument queries
- `searchInstruments()` - LIKE queries for search
- `findInstrumentsByIds()` - Batch fetch (N+1 prevention)

**7. Configuration** (`src/config/`)

**`database.ts`** - Connection pool and transaction wrapper
**`env.ts`** - Environment variable validation
**`dependencies.ts`** - Dependency injection container

---

## Testing Strategy

### Test Structure

```
src/tests/
├── unit/                    # Isolated service tests with mocks
│   └── services/
│       ├── order.service.test.ts
│       ├── portfolio.service.test.ts
│       └── instrument.service.test.ts
└── integration/             # Full API tests (HTTP → DB)
    ├── orders.api.test.ts
    ├── portfolio.api.test.ts
    └── instruments.api.test.ts
```

### Unit Tests

Test business logic in isolation with mocked dependencies:

```typescript
describe('OrderService', () => {
  let orderService: OrderService;
  let mockOrderRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    mockOrderRepo = {
      createOrder: jest.fn(),
      getUserAvailableCash: jest.fn(),
      // ...
    };

    orderService = new OrderService(
      mockOrderRepo,
      mockUserRepo,
      mockInstrumentRepo,
      mockMarketDataRepo
    );
  });

  it('should reject order with insufficient funds', async () => {
    mockOrderRepo.getUserAvailableCash.mockResolvedValue('500.00');

    const order = await orderService.executeOrder({
      userId: 1,
      side: 'BUY',
      size: 1000000,
      // ...
    });

    expect(order.status).toBe('REJECTED');
  });
});
```

### Integration Tests

Test full HTTP requests through the entire stack (uses real database):

```typescript
describe('Orders API', () => {
  it('should create a MARKET BUY order', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .send({
        userId: 1,
        instrumentId: 34,
        side: 'BUY',
        type: 'MARKET',
        size: 1
      })
      .expect(201);

    expect(response.body.order.status).toBe('FILLED');
  });
});
```

### Running Tests

```bash
# All tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm run test:watch

# Specific test file
npm test -- order.service.test.ts

# Integration tests only
npm run test:integration
```

**Coverage Target:** 80%+ across all layers

### Manual API Testing

The repository includes a comprehensive API testing file with all endpoints:

**File:** `api-examples.http` (use with VS Code REST Client or IntelliJ HTTP Client)

You can also test with curl commands:

```bash
# Health check
curl http://localhost:3000/api/health

# Get portfolio
curl http://localhost:3000/api/v1/users/1/portfolio

# Search instruments
curl "http://localhost:3000/api/v1/instruments/search?q=AAPL"

# Create MARKET BUY order
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"instrumentId":34,"side":"BUY","type":"MARKET","size":1}'

# Get order details
curl http://localhost:3000/api/v1/orders/1

# Get user orders (paginated)
curl http://localhost:3000/api/v1/users/1/orders

# Cancel order
curl -X PATCH http://localhost:3000/api/v1/orders/5/cancel \
  -H "Content-Type: application/json" \
  -d '{"userId":1}'
```

See `api-examples.http` for all available endpoints with detailed examples and validation scenarios.

---

## Environment Variables

### Required Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | string | `development` | Environment: `development`, `test`, `production` |
| `PORT` | number | `3000` | HTTP server port |
| `DB_HOST` | string | `localhost` | PostgreSQL host |
| `DB_PORT` | number | `5432` | PostgreSQL port |
| `DB_NAME` | string | `cocos_trading` | Database name |
| `DB_USER` | string | `postgres` | Database user |
| `DB_PASSWORD` | string | `postgres` | Database password |
| `DB_MAX_CONNECTIONS` | number | `20` | Max connection pool size |
| `LOG_LEVEL` | string | `info` | Log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `LOG_PRETTY` | boolean | `true` | Pretty-print logs (dev only) |

### Optional Variables (for AWS deployment)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LOGGER_TYPE` | string | `console` | Logger: `console` or `cloudwatch` |
| `METRICS_TYPE` | string | `noop` | Metrics: `noop` or `cloudwatch` |
| `AWS_REGION` | string | `us-east-1` | AWS region |
| `CLOUDWATCH_LOG_GROUP` | string | `/aws/cocos-trading/api` | CloudWatch log group |
| `CLOUDWATCH_LOG_STREAM` | string | `main` | CloudWatch log stream |
| `CLOUDWATCH_METRICS_NAMESPACE` | string | `CocosTrading` | CloudWatch metrics namespace |

**Files:**
- `.env.example` - Template
- `.env.local` - Docker Compose development
- `.env.aws` - AWS production template

---

## FAQ

### Q: Why no ORM (TypeORM, Prisma, Sequelize)?

**A:** ORMs add complexity and hide SQL execution. For financial systems, explicit SQL provides:
- Full control over complex queries
- Transparency (see exactly what runs)
- Better performance (no hidden query generation)
- Easier optimization

TypeScript interfaces provide type safety without an ORM.

### Q: How do I debug?

**A:**
- **Logs:** All operations logged with Pino (structured JSON)
- **VS Code debugger:** Set breakpoints in TypeScript
- **Grafana:** View real-time logs and metrics (http://localhost:3001)
- **Database queries:** Check logs for SQL queries with parameters

### Q: What's the deal with `Decimal.js` everywhere?

**A:** JavaScript's `Number` type uses floating-point arithmetic, causing precision errors:
```javascript
0.1 + 0.2 = 0.30000000000000004  // ❌ Unacceptable for finance
```

`Decimal.js` provides exact decimal arithmetic:
```javascript
new Decimal('0.1').plus('0.2').toString() === '0.3'  // ✅
```

This is **critical** for financial calculations.

### Q: Why are prices stored as strings in the database?

**A:** PostgreSQL's `NUMERIC` type returns values as strings to preserve precision. We convert to `Decimal` for calculations:

```typescript
const price = '885.80';  // From database
const total = new Decimal(price).times(size);  // Exact calculation
```

### Q: How does transaction isolation prevent race conditions?

**A:** PostgreSQL's `READ COMMITTED` isolation with `FOR UPDATE` locks:

1. Transaction A starts, locks user's orders with `FOR UPDATE`
2. Transaction B tries to read same orders, **blocks** until A commits
3. Transaction A validates and commits
4. Transaction B now reads updated data

This prevents double-spending even under high concurrency.

### Q: Can I run this in production without authentication?

**A:** **NO.** Authentication is not implemented yet. Before production:
- Implement JWT or session-based auth
- Add `authMiddleware` to routes
- Validate user ownership of resources
- See [Future Improvements](#future-improvements)

### Q: How do I add a new environment variable?

**A:**
1. Add to `.env.example`
2. Add validation in `src/config/env.ts`:
   ```typescript
   export const env = cleanEnv(process.env, {
     NEW_VAR: str({ default: 'value' }),
   });
   ```
3. Use in code: `env.NEW_VAR`

### Q: Why does portfolio calculation use FILLED orders only?

**A:** Only executed orders affect positions:
- `NEW` - Not yet executed (LIMIT orders waiting for price)
- `FILLED` - Executed, affects portfolio ✅
- `REJECTED` - Never executed (insufficient funds/shares)
- `CANCELLED` - Cancelled by user, didn't execute

### Q: What happens if PostgreSQL goes down?

**A:**
- API returns 500 errors
- Connection pool attempts reconnection (configurable timeout)
- Errors logged to CloudWatch/Grafana
- Health check fails: `GET /api/health` returns error

**Production:** Use RDS Multi-AZ for high availability.

### Q: How do I add a new order type?

**A:**
1. Add to constants: `src/constants/instruments.ts`
2. Update validation: `src/validators/order.validator.ts`
3. Add business logic: `src/services/order.service.ts` - `executeOrder()`
4. Add tests: `src/tests/unit/services/order.service.test.ts`

---

**Author:** Erik Gomez
**Last Updated:** February 2026
**Repository:** [github.com/your-username/cocos-trading-api](https://github.com)
