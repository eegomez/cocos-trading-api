import { LatestMarketData } from '@/models';

/**
 * Market Data Repository Interface
 * Defines the contract for market data access operations
 */
export interface IMarketDataRepository {
  /**
   * Get the latest market data for a specific instrument
   * @param instrumentId - The instrument's ID
   * @returns Promise resolving to LatestMarketData or null if not found
   */
  getLatestMarketDataForInstrument(
    instrumentId: number
  ): Promise<LatestMarketData | null>;

  /**
   * Get the latest market data for multiple instruments
   * @param instrumentIds - Array of instrument IDs
   * @returns Promise resolving to Map of instrumentId -> LatestMarketData
   */
  getLatestMarketDataForInstruments(
    instrumentIds: number[]
  ): Promise<Map<number, LatestMarketData>>;
}
