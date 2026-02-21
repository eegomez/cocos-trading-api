import { InstrumentType } from '@/constants/instruments';

/**
 * Instrument model
 * Matches the 'instruments' table schema
 *
 * Types:
 * - 'ACCIONES': Stocks
 * - 'MONEDA': Currency (only ARS in our case)
 */
export interface Instrument {
  id: number;
  ticker: string;
  name: string;
  type: InstrumentType;
}

/**
 * Instrument with current market price
 * Used in search results
 *
 * Note: Prices are strings (from NUMERIC columns) to preserve precision
 * Convert to number for display, or to Decimal for calculations
 */
export interface InstrumentWithPrice extends Instrument {
  lastPrice: string | null;
  previousClose: string | null;
  dailyChange: string | null; // Percentage change
}
