import { Request, Response, NextFunction } from 'express';
import { orderService, portfolioService } from '@/config/dependencies';
import { ValidationError } from '@/errors';

/**
 * Users Controller
 * Handles HTTP requests for user-related endpoints
 */

/**
 * GET /api/users/:userId/portfolio
 * Get user's portfolio with positions and returns
 */
export async function getPortfolio(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = parseInt(req.params.userId!, 10);

    if (isNaN(userId) || userId <= 0) {
      throw new ValidationError('Invalid user ID');
    }

    const portfolio = await portfolioService.getUserPortfolio(userId);

    res.json(portfolio);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/:userId/orders?limit=50&cursor=2024-01-15T10:30:00Z
 * Get orders for a user with cursor pagination
 *
 * Query Parameters:
 * - limit: Number of orders to return (default: 50, max: 200)
 * - cursor: ISO timestamp of last order from previous page
 */
export async function getUserOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = parseInt(req.params.userId!, 10);

    if (isNaN(userId) || userId <= 0) {
      throw new ValidationError('Invalid user ID');
    }

    // Parse pagination parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const cursor = req.query.cursor as string | undefined;

    // Validate limit
    if (limit !== undefined && (isNaN(limit) || limit <= 0 || limit > 200)) {
      throw new ValidationError('Invalid limit. Must be between 1 and 200');
    }

    const response = await orderService.getUserOrders(userId, limit, cursor);

    res.json(response);
  } catch (error) {
    next(error);
  }
}
