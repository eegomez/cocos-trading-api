/**
 * Business Rules Configuration
 *
 * Centralized configuration for all business rules and limits.
 * These values can be adjusted without touching validation schemas or service logic.
 *
 * IMPORTANT: When changing these values, consider:
 * 1. Impact on user experience
 * 2. Database performance implications
 * 3. Financial risk exposure
 * 4. System capacity limits
 */

/**
 * Order Limits
 *
 * These limits prevent abuse and protect against edge cases:
 * - MAX_ORDER_SIZE: Prevents integer overflow and unrealistic positions
 * - MAX_ORDER_AMOUNT: Caps maximum ARS value per order
 * - MIN_ORDER_SIZE: Prevents dust orders (too small to be meaningful)
 */
export const ORDER_LIMITS = {
  /**
   * Maximum number of shares per order
   * Rationale: 1M shares is well above realistic retail trading volumes
   * Trade-off: High enough for legitimate use, low enough to prevent abuse
   */
  MAX_ORDER_SIZE: 1_000_000,

  /**
   * Maximum order amount in ARS
   * Rationale: 100M ARS (~$400k USD) is institutional-level trading
   * Trade-off: Allows large orders, but prevents system abuse
   */
  MAX_ORDER_AMOUNT: 100_000_000,

  /**
   * Minimum order size in shares
   * Rationale: Prevents fractional shares and dust orders
   * Trade-off: Low enough for accessibility, high enough to avoid noise
   */
  MIN_ORDER_SIZE: 1,
} as const;

/**
 * Search & Pagination Limits
 *
 * Controls API response sizes and query performance:
 * - MAX_SEARCH_RESULTS: Limits instrument search to prevent heavy queries
 * - DEFAULT_PAGE_SIZE: Reasonable default for paginated responses
 * - MAX_PAGE_SIZE: Prevents clients from requesting entire tables
 */
export const PAGINATION_LIMITS = {
  /**
   * Maximum results for instrument search
   * Rationale: 50 results fit in one screen, encourages specific queries
   * Trade-off: Forces pagination, but improves UX (focused results)
   */
  MAX_SEARCH_RESULTS: 50,

  /**
   * Default page size for paginated endpoints
   * Rationale: Balance between fewer API calls and smaller payloads
   */
  DEFAULT_PAGE_SIZE: 50,

  /**
   * Maximum page size to prevent abuse
   * Rationale: 200 is large enough for bulk operations, small enough to prevent DoS
   */
  MAX_PAGE_SIZE: 200,
} as const;

/**
 * Rate Limiting Configuration
 *
 * Protects API from abuse and ensures fair usage:
 * - WINDOW_MS: Time window for rate limiting (1 minute)
 * - Global limits apply to all endpoints except /health
 * - Stricter limits for mutation operations (POST, PATCH, DELETE)
 */
export const RATE_LIMITS = {
  /**
   * Global rate limit for all endpoints
   * Rationale: 100 req/min allows active trading without enabling abuse
   * Trade-off: ~2 req/sec is reasonable for retail users
   */
  GLOBAL: {
    WINDOW_MS: 60_000, // 1 minute
    MAX_REQUESTS: 100,
  },

  /**
   * Stricter limit for order creation
   * Rationale: Prevent rapid-fire order spam, flash crashes
   * Trade-off: 30 orders/min allows active trading but prevents HFT abuse
   */
  ORDERS: {
    WINDOW_MS: 60_000, // 1 minute
    MAX_REQUESTS: 30,
  },

  /**
   * Search endpoint limit
   * Rationale: Search is read-only but can be expensive (DB queries)
   * Trade-off: Higher than orders, lower than reads
   */
  SEARCH: {
    WINDOW_MS: 60_000, // 1 minute
    MAX_REQUESTS: 60,
  },
} as const;

/**
 * Cache & TTL Configuration
 *
 * Time-to-live values for temporary data:
 * - IDEMPOTENCY_KEY_TTL: How long idempotency keys are valid
 */
export const TTL_CONFIG = {
  /**
   * Idempotency key validity period (24 hours)
   * Rationale: Long enough for retry scenarios, short enough to prevent bloat
   * Use case: Network timeouts, client crashes, retry logic
   */
  IDEMPOTENCY_KEY_TTL_SECONDS: 86400, // 24 hours
} as const;

/**
 * Database Query Configuration
 *
 * Timeouts and limits for database operations:
 */
export const DB_QUERY_LIMITS = {
  /**
   * Global statement timeout (10 seconds)
   * Rationale: Most queries should complete in <100ms, 10s catches runaways
   * Trade-off: Kills slow queries, prevents connection starvation
   */
  STATEMENT_TIMEOUT_MS: 10_000,

  /**
   * Slow query threshold for logging (1 second)
   * Rationale: Log queries taking >1s for performance monitoring
   */
  SLOW_QUERY_THRESHOLD_MS: 1_000,
} as const;

/**
 * Type exports for TypeScript safety
 */
export type OrderLimits = typeof ORDER_LIMITS;
export type PaginationLimits = typeof PAGINATION_LIMITS;
export type RateLimits = typeof RATE_LIMITS;
export type TTLConfig = typeof TTL_CONFIG;
export type DBQueryLimits = typeof DB_QUERY_LIMITS;
