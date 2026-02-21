/**
 * Database Connection Pool Configuration
 *
 * PostgreSQL connection pool settings optimized for production workloads.
 * These values are carefully chosen based on trade-offs between performance,
 * resource usage, and reliability.
 *
 * IMPORTANT: These settings directly impact:
 * - Application latency (connection wait times)
 * - Database load (number of active connections)
 * - Memory usage (each connection ~10MB)
 * - Failure recovery (how quickly system recovers from issues)
 */

import { env } from './env';

/**
 * Connection Pool Configuration
 *
 * Based on PostgreSQL best practices and Node.js pg library recommendations.
 * See: https://node-postgres.com/apis/pool
 */
export const DATABASE_POOL_CONFIG = {
  /**
   * Minimum number of connections to keep in pool
   *
   * Value: 5 connections
   *
   * Why 5?
   * - Avoids "cold start" latency on first requests (connections are pre-warmed)
   * - Low enough to not waste resources during idle periods
   * - High enough to handle small traffic bursts immediately
   *
   * Trade-offs:
   * ✅ Pro: First requests are fast (no connection creation delay)
   * ✅ Pro: Small traffic bursts don't cause connection creation overhead
   * ❌ Con: Uses ~50MB memory even when idle (5 connections × ~10MB each)
   * ❌ Con: Database sees 5 idle connections per app instance
   *
   * When to adjust:
   * - Increase if you see connection creation delays during traffic spikes
   * - Decrease if memory/DB connection limits are tight
   */
  min: 5,

  /**
   * Maximum number of connections in pool
   *
   * Value: From env.DB_MAX_CONNECTIONS (default: 20)
   *
   * Why 20?
   * - PostgreSQL default max_connections = 100
   * - Leave headroom for admin connections, monitoring, etc.
   * - One app instance = 20 max, can run ~4 instances safely
   *
   * Trade-offs:
   * ✅ Pro: Handles high concurrency (20 simultaneous queries)
   * ✅ Pro: Won't exhaust database connection limit
   * ❌ Con: High memory usage under load (20 × 10MB = 200MB)
   * ❌ Con: Database must handle up to 20 connections per app instance
   *
   * When to adjust:
   * - Increase if you see "connection pool exhausted" errors
   * - Decrease if running many app instances (e.g., 10 instances × 20 = 200 connections!)
   */
  max: env.DB_MAX_CONNECTIONS || 20,

  /**
   * Idle connection timeout (5 minutes)
   *
   * Value: 300,000ms (5 minutes)
   *
   * Why 5 minutes?
   * - Long enough to handle temporary traffic dips without churn
   * - Short enough to free resources during extended quiet periods
   * - Prevents connection thrashing during normal usage patterns
   *
   * Example scenario:
   * ```
   * 10:00 AM - 500 req/sec → Pool grows to 20 connections
   * 10:05 AM - Traffic drops to 50 req/sec → 15 connections idle
   * 10:10 AM - Still low traffic → Idle connections closed, pool shrinks to ~7
   * 10:15 AM - Traffic spikes to 500 req/sec → Pool grows again (fast, only 13 new connections)
   * ```
   *
   * Trade-offs:
   * ✅ Pro: Doesn't close connections during short traffic dips
   * ✅ Pro: Reduces connection creation churn (creating connections is slow ~100ms)
   * ❌ Con: Keeps connections alive longer (uses DB resources)
   *
   * When to adjust:
   * - Increase (e.g., 10 min) if traffic has predictable spikes (keep connections warm)
   * - Decrease (e.g., 1 min) if DB connection limit is very tight
   */
  idleTimeoutMillis: 300_000, // 5 minutes

  /**
   * Connection acquisition timeout (10 seconds)
   *
   * Value: 10,000ms (10 seconds)
   *
   * Why 10 seconds?
   * - Longer than typical query time (<1s), allows waiting for busy connections
   * - Short enough to fail fast if DB is truly overloaded
   * - Gives time for slow queries to complete and free connections
   *
   * What this means:
   * - Request arrives → All 20 connections busy → Wait up to 10s for one to free
   * - If no connection available after 10s → Throw error
   *
   * Trade-offs:
   * ✅ Pro: Tolerates temporary spikes (waits for connections to free)
   * ✅ Pro: Reduces "connection timeout" errors during normal load
   * ❌ Con: Slow error feedback if database is truly overloaded
   * ❌ Con: Can cause request queuing (user waits 10s before seeing error)
   *
   * When to adjust:
   * - Increase (e.g., 30s) if you have legitimate long-running queries
   * - Decrease (e.g., 5s) if you want faster failure feedback
   */
  connectionTimeoutMillis: 10_000, // 10 seconds

  /**
   * Maximum connection lifetime uses (7,500 queries)
   *
   * Value: 7,500 uses before recycling connection
   *
   * Why 7,500?
   * - PostgreSQL connections can leak memory over time (prepared statements, temp tables, etc.)
   * - Recycling prevents long-lived connections from accumulating cruft
   * - At ~100 req/sec, a connection handles ~7,500 queries in ~75 seconds (reasonable lifespan)
   *
   * What this means:
   * - Connection is created
   * - Handles 7,500 queries
   * - Gets closed and replaced with fresh connection
   *
   * Trade-offs:
   * ✅ Pro: Prevents memory leaks in long-lived connections
   * ✅ Pro: Ensures connections don't accumulate state/cruft
   * ❌ Con: Slight overhead recycling connections (minimal)
   *
   * When to adjust:
   * - Increase (e.g., 10,000) if connection creation overhead is significant
   * - Decrease (e.g., 5,000) if you notice memory growth in DB connections
   */
  maxUses: 7_500,
} as const;

/**
 * Export individual values for convenience
 */
export const { min, max, idleTimeoutMillis, connectionTimeoutMillis, maxUses } =
  DATABASE_POOL_CONFIG;

/**
 * Type export for TypeScript safety
 */
export type DatabasePoolConfig = typeof DATABASE_POOL_CONFIG;
