import { query } from '@/config/database';
import { LatestMarketData } from '@/models';
import { IMarketDataRepository } from './interfaces/IMarketDataRepository';

/**
 * Market Data Repository
 * Handles all database operations for market data
 */
export class MarketDataRepository implements IMarketDataRepository {
  /**
   * Get latest market data for a specific instrument
   *
   * @param instrumentId - Instrument ID
   * @returns Latest market data or null if not found
   */
  async getLatestMarketDataForInstrument(
    instrumentId: number
  ): Promise<LatestMarketData | null> {
    const result = await query<LatestMarketData>(
      `
      SELECT
        instrumentid AS "instrumentId",
        close,
        previousclose AS "previousClose",
        date
      FROM marketdata
      WHERE instrumentid = $1
      ORDER BY date DESC
      LIMIT 1
      `,
      [instrumentId]
    );

    const row = result.rows[0];
    if (!row) return null;

    // Prices are NUMERIC (returned as strings for precision)
    return row;
  }

  /**
   * Get latest market data for multiple instruments
   *
   * @param instrumentIds - Array of instrument IDs
   * @returns Map of instrumentId -> LatestMarketData
   */
  async getLatestMarketDataForInstruments(
    instrumentIds: number[]
  ): Promise<Map<number, LatestMarketData>> {
    if (instrumentIds.length === 0) {
      return new Map();
    }

    const result = await query<LatestMarketData>(
      `
      SELECT DISTINCT ON (instrumentid)
        instrumentid AS "instrumentId",
        close,
        previousclose AS "previousClose",
        date
      FROM marketdata
      WHERE instrumentid = ANY($1)
      ORDER BY instrumentid, date DESC
      `,
      [instrumentIds]
    );

    // Prices are NUMERIC (returned as strings for precision)
    const marketDataMap = new Map<number, LatestMarketData>();
    for (const row of result.rows) {
      marketDataMap.set(row.instrumentId, row);
    }

    return marketDataMap;
  }
}
