import { Router } from 'express';
import * as instrumentsController from '@/controllers/instruments.controller';
import { searchRateLimiter } from '@/middlewares/rateLimiter';

const router = Router();

/**
 * GET /api/instruments/search?q=query
 * Search instruments by ticker or name
 *
 * Pagination Strategy: Offset-based (LIMIT 50)
 * Why offset for search:
 * - Small result set (max 50 results)
 * - Users don't need deep pagination for search
 * - Simpler UX (no cursor to manage)
 * Trade-off: Cursor would be faster for deep pagination, but not needed here
 */
router.get('/search', searchRateLimiter, instrumentsController.searchInstruments);

export default router;
