import { Instrument, InstrumentWithPrice } from '@/models';

/**
 * Instrument Repository Interface
 * Defines the contract for instrument data access operations
 */
export interface IInstrumentRepository {
  /**
   * Find an instrument by its ID
   * @param instrumentId - The instrument's ID
   * @returns Promise resolving to Instrument or null if not found
   */
  findInstrumentById(instrumentId: number): Promise<Instrument | null>;

  /**
   * Find multiple instruments by their IDs
   * @param instrumentIds - Array of instrument IDs
   * @returns Promise resolving to array of instruments
   */
  findInstrumentsByIds(instrumentIds: number[]): Promise<Instrument[]>;

  /**
   * Search stocks (ACCIONES only) by ticker or name
   * Excludes currencies (MONEDA)
   * @param searchQuery - Search term to match against ticker or name
   * @returns Promise resolving to array of stock instruments with price data
   */
  searchStockInstruments(searchQuery: string): Promise<InstrumentWithPrice[]>;
}
