import { query } from '@/config/database';
import { Instrument, InstrumentWithPrice } from '@/models';
import { INSTRUMENT_TYPES } from '@/constants/instruments';
import { IInstrumentRepository } from './interfaces/IInstrumentRepository';

/**
 * Instrument Repository
 * Handles all database operations for instruments
 */
export class InstrumentRepository implements IInstrumentRepository {
  /**
   * Find instrument by ID
   */
  async findInstrumentById(instrumentId: number): Promise<Instrument | null> {
    const result = await query<Instrument>(
      'SELECT id, ticker, name, type FROM instruments WHERE id = $1',
      [instrumentId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find multiple instruments by IDs
   * More efficient than calling findInstrumentById multiple times
   */
  async findInstrumentsByIds(instrumentIds: number[]): Promise<Instrument[]> {
    if (instrumentIds.length === 0) {
      return [];
    }

    const result = await query<Instrument>(
      'SELECT id, ticker, name, type FROM instruments WHERE id = ANY($1) ORDER BY ticker',
      [instrumentIds]
    );

    return result.rows;
  }

  /**
   * Search stocks by ticker or name
   * Only returns STOCK instruments (excludes currencies)
   *
   * @param searchQuery - Search term (matches ticker or name)
   * @returns List of stock instruments with current prices and calculated daily change
   */
  async searchStockInstruments(
    _searchQuery: string
  ): Promise<InstrumentWithPrice[]> {
    // Escape LIKE special characters to prevent SQL injection via pattern matching
    // LIKE special chars: % (wildcard multi), _ (wildcard single), \ (escape char)
    // Without escaping: User input "100%" would match "100", "1000", "100ABC", etc.
    // With escaping: User input "100%" matches literally "100%"
    const escapedQuery = _searchQuery.replace(/[%_\\]/g, '\\$&');
    const searchTerm = `%${escapedQuery.toUpperCase()}%`;

    const result = await query<Omit<InstrumentWithPrice, 'dailyChange'>>(
      `
      SELECT
        i.id,
        i.ticker,
        i.name,
        i.type,
        md.close as "lastPrice",
        md.previousclose as "previousClose"
      FROM instruments i
      LEFT JOIN LATERAL (
        SELECT close, previousclose
        FROM marketdata
        WHERE instrumentid = i.id
        ORDER BY date DESC
        LIMIT 1
      ) md ON true
      WHERE i.type = $1
        AND (
          UPPER(i.ticker) LIKE $2
          OR UPPER(i.name) LIKE $2
        )
      ORDER BY i.ticker
      LIMIT 50
      `,
      [INSTRUMENT_TYPES.STOCK, searchTerm]
    );

    // Calculate dailyChange in application layer (not in database)
    return result.rows.map((row) => ({
      ...row,
      dailyChange: this.calculateDailyChange(row.lastPrice, row.previousClose),
    }));
  }

  /**
   * Calculate daily percentage change
   * Keeps business logic in application layer, not database
   */
  private calculateDailyChange(
    currentPrice: string | null,
    previousPrice: string | null
  ): string | null {
    if (!currentPrice || !previousPrice) return null;

    const current = parseFloat(currentPrice);
    const previous = parseFloat(previousPrice);

    if (previous <= 0) return null;

    const change = ((current - previous) / previous) * 100;
    return change.toFixed(2);
  }
}
