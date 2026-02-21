/**
 * Latest market data for an instrument
 * Used for portfolio calculations
 * Price fields are strings (NUMERIC from DB) for precision
 */
export interface LatestMarketData {
  instrumentId: number;
  close: string;
  previousClose: string;
  date: Date;
}
