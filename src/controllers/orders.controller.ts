import { Request, Response, NextFunction } from 'express';
import { orderService } from '@/config/dependencies';
import { createOrderSchema } from '@/validators/order.validator';
import { ValidationError } from '@/errors';
import { logger } from '@/adapters/logging/LoggerFactory';

/**
 * Orders Controller
 * Handles HTTP requests for order endpoints
 */

/**
 * POST /api/orders
 * Submit a new order (MARKET or LIMIT)
 */
export async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validationResult = createOrderSchema.safeParse(req.body);

    if (!validationResult.success) {
      logger.error({
        body: req.body,
        errors: validationResult.error.flatten()
      }, 'Zod validation failed');
      throw new ValidationError(
        'Invalid order data',
        validationResult.error.flatten()
      );
    }

    const orderData = validationResult.data;

    const response = await orderService.executeOrder(orderData);

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/orders/:orderId
 * Get order details by ID
 */
export async function getOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orderId = parseInt(req.params.orderId!, 10);

    if (isNaN(orderId) || orderId <= 0) {
      throw new ValidationError('Invalid order ID');
    }

    const order = await orderService.getOrderById(orderId);

    res.json(order);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/orders/:orderId/cancel
 * Cancel an order (only NEW orders can be cancelled)
 */
export async function cancelOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orderId = parseInt(req.params.orderId!, 10);
    const userId = req.body.userId;

    if (isNaN(orderId) || orderId <= 0) {
      throw new ValidationError('Invalid order ID');
    }

    if (!userId || typeof userId !== 'number' || userId <= 0) {
      throw new ValidationError('Valid userId is required');
    }

    const response = await orderService.cancelOrder(orderId, userId);

    res.json(response);
  } catch (error) {
    next(error);
  }
}

