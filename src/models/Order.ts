import { OrderType, OrderSide, OrderStatus } from '@/constants/instruments';

/**
 * Order model
 * Matches the 'orders' table schema
 *
 * IMPORTANT: Column names are camelCase to match database:
 * - instrumentId (not instrument_id)
 * - userId (not user_id)
 * - datetime (TIMESTAMP type)
 */
export interface Order {
  id: number;
  instrumentId: number;
  userId: number;
  size: number; // INTEGER from DB (returns as number)
  price: string; // NUMERIC from DB (returns as string for precision)
  type: OrderType;
  side: OrderSide;
  status: OrderStatus;
  datetime: Date;
}

/**
 * Order creation input
 * Used when submitting a new order
 */
export interface CreateOrderInput {
  userId: number;
  instrumentId: number;
  side: OrderSide;
  type: OrderType;
  size?: number; // Optional: can specify size OR amount
  amount?: number; // Optional: total investment amount in ARS
  price?: number | string; // Required for LIMIT orders, ignored for MARKET (string is canonical from DB)
}

/**
 * Order with instrument details
 * Used in API responses
 */
export interface OrderWithInstrument extends Order {
  ticker: string;
  name: string;
}
