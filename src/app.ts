import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { env } from '@/config/env';
import { requestLogger } from '@/middlewares/requestLogger';
import { logger } from '@/adapters/logging/LoggerFactory';
import { errorHandler } from '@/middlewares/errorHandler';
import { notFoundHandler } from '@/middlewares/notFound';
import { globalRateLimiter } from '@/middlewares/rateLimiter';
import { metricsMiddleware } from '@/api/middlewares/metricsMiddleware';
import apiRoutes from '@/api/routes';

/**
 * Express Application Setup
 * Configures middleware, routes, and error handlers
 */

const app: Application = express();

// ============================================
// Middleware Configuration
// ============================================

// Trust proxy headers for accurate client IP detection
// Required when behind reverse proxy (Nginx, AWS ALB, Heroku, etc.)
// - Enables req.ip to return actual client IP from X-Forwarded-For
// - Without this, all requests appear to come from proxy IP
// - Security: Only enable if you control the proxy (prevents IP spoofing)
app.set('trust proxy', true);

// Security headers
app.use(helmet());

// CORS - Disable in production (API should not be called from browsers)
// In development, allow any origin but without credentials
app.use(
  cors({
    origin: env.NODE_ENV === 'production' ? false : '*',
    credentials: false,
  })
);

// Body parsers with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// HTTP metrics tracking (tracks all requests except /health and /metrics)
app.use(metricsMiddleware);

// Global rate limiting (all routes except /health)
// Applies 100 requests/minute limit to prevent abuse
app.use(globalRateLimiter);

// Request logging (pino-http)
app.use(requestLogger);

// ============================================
// Routes
// ============================================

// Swagger API Documentation
try {
  const openapiPath = join(__dirname, '../docs/openapi.yaml');
  const openapiDocument = yaml.load(readFileSync(openapiPath, 'utf8'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument as any));
} catch (error) {
  logger.warn({ error }, 'Could not load OpenAPI documentation');
}

// API routes (mounted at /api)
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Cocos Trading API',
    version: '1.0.0',
    description: 'Trading Portfolio Management API',
    documentation: '/api-docs',
    endpoints: {
      health: '/api/health',
      portfolio: '/api/portfolio/:userId',
      search: '/api/instruments/search?q=query',
      orders: '/api/orders',
      order: '/api/orders/:orderId',
    },
  });
});

// ============================================
// Error Handlers
// ============================================

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
