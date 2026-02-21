import { Router } from 'express';
import * as ordersController from '@/controllers/orders.controller';
import { orderCreationRateLimiter } from '@/middlewares/rateLimiter';

const router = Router();

/**
 * POST /api/orders
 * Submit a new order (MARKET or LIMIT)
 * Applies stricter rate limiting (30 orders/minute)
 */
router.post('/', orderCreationRateLimiter, ordersController.createOrder);

/**
 * GET /api/orders/:orderId
 * Get order details by ID
 */
router.get('/:orderId', ordersController.getOrder);

/**
 * PATCH /api/orders/:orderId/cancel
 * Cancel an order (only NEW orders can be cancelled)
 */
router.patch('/:orderId/cancel', ordersController.cancelOrder);

export default router;
