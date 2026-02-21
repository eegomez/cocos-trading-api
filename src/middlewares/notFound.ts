import { Request, Response } from 'express';

/**
 * 404 Not Found handler
 * Handles requests to undefined routes
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      message: 'not found',
    },
  });
}
