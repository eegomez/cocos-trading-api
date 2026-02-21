import { InstrumentWithPrice } from '@/models';
import { IInstrumentRepository } from '@/repositories/interfaces';
import { logger } from '@/adapters/logging/LoggerFactory';

/**
 * Instrument Service
 * Business logic for instrument operations
 */
export class InstrumentService {
  constructor(private instrumentRepo: IInstrumentRepository) {}

  /**
   * Search stocks by ticker or name
   *
   * @param searchQuery - Search term
   * @returns Formatted response with query, count, and results
   */
  async searchInstruments(searchQuery: string): Promise<{
    query: string;
    count: number;
    results: InstrumentWithPrice[];
  }> {
    // Trim and validate search query
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length === 0) {
      logger.debug({ originalQuery: searchQuery }, 'Search skipped: empty query');
      return {
        query: searchQuery,
        count: 0,
        results: [],
      };
    }

    // Search stocks in repository
    const instruments = await this.instrumentRepo.searchStockInstruments(trimmedQuery);

    logger.info(
      { query: trimmedQuery, resultCount: instruments.length },
      'Stock search completed'
    );

    return {
      query: searchQuery,
      count: instruments.length,
      results: instruments,
    };
  }
}
