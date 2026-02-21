import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '@/config/env';
import { logger } from '@/adapters/logging/LoggerFactory';
import { DATABASE_POOL_CONFIG } from '@/config/database.config';
import { DB_QUERY_LIMITS } from '@/config/businessRules';

/**
 * PostgreSQL connection pool
 * Using pooling for efficient connection management
 * Configuration values come from database.config.ts (see detailed explanations there)
 */
const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  // SSL configuration (required for cloud databases like Neon, AWS RDS, etc.)
  ssl: {
    rejectUnauthorized: false,
  },
  // Pool configuration from database.config.ts
  min: DATABASE_POOL_CONFIG.min,
  max: DATABASE_POOL_CONFIG.max,
  idleTimeoutMillis: DATABASE_POOL_CONFIG.idleTimeoutMillis,
  connectionTimeoutMillis: DATABASE_POOL_CONFIG.connectionTimeoutMillis,
  maxUses: DATABASE_POOL_CONFIG.maxUses,
});

// Log pool errors
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
  // Let pool handle client recycling - don't crash the process
});

// Log successful connection and set statement timeout
pool.on('connect', async (client) => {
  logger.debug('New PostgreSQL client connected to pool');

  // Set global statement timeout to prevent runaway queries
  // This applies to ALL queries on this connection
  // Prevents connection starvation from slow/hanging queries
  try {
    await client.query(`SET statement_timeout = ${DB_QUERY_LIMITS.STATEMENT_TIMEOUT_MS}`);
    logger.debug(
      { timeout_ms: DB_QUERY_LIMITS.STATEMENT_TIMEOUT_MS },
      'Statement timeout configured for connection'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to set statement timeout');
  }
});

/**
 * Execute a SQL query with parameters
 * @param text - SQL query string
 * @param params - Query parameters
 * @returns Query result
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    logger.debug(
      {
        query: text,
        duration,
        rows: result.rowCount,
      },
      'Executed SQL query'
    );

    return result;
  } catch (error) {
    logger.error(
      {
        error,
        query: text,
        paramCount: params?.length || 0,
      },
      'Database query error'
    );
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * IMPORTANT: Remember to call client.release() when done
 */
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

/**
 * Execute a function within a database transaction
 * Automatically handles commit/rollback
 *
 * Isolation Level: READ COMMITTED (PostgreSQL default)
 * - Prevents dirty reads (reading uncommitted data)
 * - Allows non-repeatable reads (same query, different results)
 * - Works with FOR UPDATE locks for financial transactions
 *
 * Why READ COMMITTED is appropriate:
 * - Combined with FOR UPDATE, provides sufficient isolation for order execution
 * - Lower lock contention than REPEATABLE READ or SERIALIZABLE
 * - Industry standard for financial transactions at this scale
 *
 * @param callback - Function to execute within transaction
 * @returns Result of the callback function
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();

  try {
    // Explicit isolation level for clarity and documentation
    // READ COMMITTED is PostgreSQL default, but making it explicit
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED');
    logger.debug('Transaction started with READ COMMITTED isolation');

    const result = await callback(client);

    await client.query('COMMIT');
    logger.debug('Transaction committed');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error }, 'Transaction rolled back');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test database connection
 * Useful for health checks and startup validation
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW()');
    logger.info(
      { time: result.rows[0]?.now },
      'Database connection successful'
    );
    return true;
  } catch (error) {
    logger.error({ error }, 'Database connection failed');
    return false;
  }
}

/**
 * Close all connections in the pool
 * Should be called during graceful shutdown
 */
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}

export { pool };
