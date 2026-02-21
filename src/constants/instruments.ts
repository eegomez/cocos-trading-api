/**
 * Critical constant: ARS currency instrument ID
 * This is the instrumentId for Argentine Peso (ARS) in the database
 * Used for CASH_IN and CASH_OUT operations
 *
 * From database.sql:
 * INSERT INTO instruments (ticker,"name","type") VALUES ('ARS','PESOS','MONEDA');
 * This insert happens at line 120, making it instrumentId = 66
 */
export const ARS_INSTRUMENT_ID = 66;

/**
 * Instrument types from database
 */
export const INSTRUMENT_TYPES = {
  STOCK: 'ACCIONES',
  CURRENCY: 'MONEDA',
} as const;

/**
 * Order types
 */
export const ORDER_TYPES = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
} as const;

/**
 * Order sides
 */
export const ORDER_SIDES = {
  BUY: 'BUY',
  SELL: 'SELL',
  CASH_IN: 'CASH_IN',
  CASH_OUT: 'CASH_OUT',
} as const;

/**
 * Order statuses
 */
export const ORDER_STATUSES = {
  NEW: 'NEW',
  FILLED: 'FILLED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

// Type exports
export type InstrumentType = (typeof INSTRUMENT_TYPES)[keyof typeof INSTRUMENT_TYPES];
export type OrderType = (typeof ORDER_TYPES)[keyof typeof ORDER_TYPES];
export type OrderSide = (typeof ORDER_SIDES)[keyof typeof ORDER_SIDES];
export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];
