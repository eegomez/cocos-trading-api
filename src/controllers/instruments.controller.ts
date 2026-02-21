import { Request, Response, NextFunction } from 'express';
import { instrumentService } from '@/config/dependencies';
import { ValidationError } from '@/errors';

/**
 * Instruments Controller
 * Handles HTTP requests for instrument endpoints
 */

/**
 * GET /api/instruments/search?q=query
 * Search instruments by ticker or name
 */
export async function searchInstruments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const searchQuery = req.query.q as string;

    if (!searchQuery || searchQuery.trim().length === 0) {
      throw new ValidationError('Search query "q" is required');
    }

    const response = await instrumentService.searchInstruments(searchQuery);

    res.json(response);
  } catch (error) {
    next(error);
  }
}
