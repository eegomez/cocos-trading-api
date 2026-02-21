/**
 * Rate Limiting Middleware
 *
 * Protects API from abuse using express-rate-limit (battle-tested, 10M+ downloads/week).
 * Applies different limits to different endpoint types:
 * - Global: All endpoints (except /health)
 * - Orders: Stricter limit for order creation (prevents flash trading abuse)
 * - Search: Moderate limit for search endpoints (expensive DB queries)
 *
 * How it works:
 * - Tracks requests per IP address in a time window
 * - Returns 429 Too Many Requests when limit exceeded
 * - Window is sliding (not fixed interval)
 *
 * For production scaling:
 * - Default: In-memory store (works for single instance)
 * - Multi-instance: Use Redis store (shared state across instances)
 */

import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { RATE_LIMITS } from '@/config/businessRules';
import { logger } from '@/adapters/logging/LoggerFactory';

/**
 * Safe IP extraction for rate limiting
 *
 * Issue: req.ip doesn't work correctly behind proxies/load balancers
 * - Direct connection: req.ip = client IP ✓
 * - Behind proxy: req.ip = proxy IP ❌ (all requests appear from same IP)
 * - Misconfigured trust proxy: req.ip = undefined ❌
 *
 * Solution:
 * 1. Trust proxy headers (configured in app.ts with app.set('trust proxy', true))
 * 2. Check X-Forwarded-For header (standard for proxies/load balancers)
 * 3. Fallback to req.socket.remoteAddress (direct connection)
 * 4. Final fallback to 'unknown' (prevents crash if all fail)
 *
 * Security Note:
 * - Only trust X-Forwarded-For if behind known proxy (AWS ALB, Nginx, etc.)
 * - Attackers can spoof X-Forwarded-For if no proxy validation
 * - For production, validate proxy source IP before trusting headers
 */
function getClientIp(req: Request): string {
  // 1. Try X-Forwarded-For header (proxy/load balancer)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For can be comma-separated (client, proxy1, proxy2)
    // First IP is the original client
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (ips) {
      const clientIp = ips.split(',')[0]?.trim();
      if (clientIp) return clientIp;
    }
  }

  // 2. Try req.ip (works if trust proxy is enabled)
  if (req.ip) return req.ip;

  // 3. Try socket remote address (direct connection)
  if (req.socket?.remoteAddress) return req.socket.remoteAddress;

  // 4. Fallback to unknown (shouldn't happen, but prevents crash)
  return 'unknown';
}

/**
 * Global rate limiter for all endpoints
 *
 * Applied to all routes except /health (health checks shouldn't be rate limited)
 */
export const globalRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.GLOBAL.WINDOW_MS,
  max: RATE_LIMITS.GLOBAL.MAX_REQUESTS,
  message: {
    success: false,
    error: {
      message: `Too many requests. Please try again later. Limit: ${RATE_LIMITS.GLOBAL.MAX_REQUESTS} requests per minute.`,
    },
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use safe IP extraction that works behind proxies
  keyGenerator: (req) => getClientIp(req),
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/api/health',
});

/**
 * Stricter rate limiter for order creation
 *
 * Prevents rapid-fire order spam and flash trading abuse
 */
export const orderCreationRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.ORDERS.WINDOW_MS,
  max: RATE_LIMITS.ORDERS.MAX_REQUESTS,
  message: {
    success: false,
    error: {
      message: `Too many order requests. Please slow down. Limit: ${RATE_LIMITS.ORDERS.MAX_REQUESTS} orders per minute.`,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  // Log when rate limit is hit for monitoring
  handler: (req, res, _next, options) => {
    logger.warn({
      type: 'RATE_LIMIT_EXCEEDED',
      endpoint: 'orders',
      ip: getClientIp(req),
      limit: options.max,
    }, 'Rate limit exceeded');
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Moderate rate limiter for search endpoints
 *
 * Search queries can be expensive (DB queries with LIKE), but are read-only
 */
export const searchRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.SEARCH.WINDOW_MS,
  max: RATE_LIMITS.SEARCH.MAX_REQUESTS,
  message: {
    success: false,
    error: {
      message: `Too many search requests. Please slow down. Limit: ${RATE_LIMITS.SEARCH.MAX_REQUESTS} searches per minute.`,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
});

/**
 * Production Scaling Notes:
 *
 * For multi-instance deployments (AWS ECS, Kubernetes), use Redis store:
 *
 * ```typescript
 * import RedisStore from 'rate-limit-redis';
 * import { createClient } from 'redis';
 *
 * const redisClient = createClient({
 *   host: process.env.REDIS_HOST,
 *   port: process.env.REDIS_PORT,
 * });
 *
 * export const globalRateLimiter = rateLimit({
 *   store: new RedisStore({
 *     client: redisClient,
 *     prefix: 'rate_limit:',
 *   }),
 *   // ... other options
 * });
 * ```
 *
 * Benefits of Redis store:
 * - Shared state across all app instances
 * - Automatic cleanup of expired keys
 * - Persistent rate limit tracking
 *
 * For single EC2 instance (interview/demo):
 * - In-memory store (default) works fine
 * - No additional infrastructure needed
 */
