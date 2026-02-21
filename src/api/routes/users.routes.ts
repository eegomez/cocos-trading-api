import { Router } from 'express';
import * as usersController from '@/controllers/users.controller';

const router = Router();

/**
 * GET /api/users/:userId/portfolio
 * Get user's portfolio with positions and returns
 */
router.get('/:userId/portfolio', usersController.getPortfolio);

/**
 * GET /api/users/:userId/orders
 * Get all orders for a specific user
 */
router.get('/:userId/orders', usersController.getUserOrders);

export default router;
