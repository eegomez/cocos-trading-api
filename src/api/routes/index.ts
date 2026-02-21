import { Router } from 'express';
import instrumentsRoutes from './instruments.routes';
import ordersRoutes from './orders.routes';
import usersRoutes from './users.routes';
import { getMetrics } from '@/api/controllers/metrics.controller';

const router = Router();

/**
 * API Routes
 * Base path: /api
 *
 * Versioning Strategy: /api/v1/*
 * - Allows breaking changes in v2 without affecting v1 clients
 * - Health and metrics endpoints stay unversioned (infrastructure, not API)
 */

// Health check endpoint (unversioned - infrastructure endpoint)
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'cocos-trading-api',
    version: 'v1',
  });
});

// Metrics endpoint (unversioned - infrastructure endpoint)
// Exposes Prometheus-format metrics for monitoring tools
// Used by: Prometheus, Grafana, DataDog, CloudWatch, PagerDuty
router.get('/metrics', getMetrics);

// v1 API routes
const v1Router = Router();

/**
 * ⚠️  CRITICAL: Authentication not implemented
 *
 * All endpoints are currently public - any client can access any user's data.
 * Must implement JWT/session authentication middleware before production deployment.
 * Add middleware here: v1Router.use(authMiddleware);
 */

v1Router.use('/instruments', instrumentsRoutes);
v1Router.use('/orders', ordersRoutes);
v1Router.use('/users', usersRoutes);

router.use('/v1', v1Router);

export default router;
