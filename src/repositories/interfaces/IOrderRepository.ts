import { PoolClient } from 'pg';
import { Order, OrderWithInstrument } from '@/models';

/**
 * Order Repository Interface
 * Defines the contract for order data access operations
 */
export interface IOrderRepository {
  /**
   * Create a new order
   * Can be called within a transaction by passing a client
   * @param orderData - Order data to create
   * @param client - Optional PoolClient for transaction support
   * @returns Promise resolving to created Order
   */
  createOrder(
    orderData: {
      instrumentId: number;
      userId: number;
      size: number;
      price: number | string; // Accept both number and string (string is canonical from PostgreSQL NUMERIC)
      type: string;
      side: string;
      status: string;
    },
    client?: PoolClient
  ): Promise<Order>;

  /**
   * Find an order by its ID, including instrument details
   * @param orderId - The order's ID
   * @returns Promise resolving to OrderWithInstrument or null if not found
   */
  findOrderById(orderId: number): Promise<OrderWithInstrument | null>;

  /**
   * Get all FILLED orders for a user
   * Used for portfolio calculations
   * @param userId - The user's ID
   * @param client - Optional PoolClient for transaction support
   * @returns Promise resolving to array of filled orders
   */
  getFilledOrdersByUserId(userId: number, client?: PoolClient): Promise<Order[]>;

  /**
   * Get user's position for a specific instrument
   * Calculates net shares from FILLED BUY and SELL orders
   * @param userId - The user's ID
   * @param instrumentId - The instrument's ID
   * @param client - Optional PoolClient for transaction support
   * @returns Promise resolving to number of shares (positive = long, negative = short)
   */
  getUserPositionForInstrument(
    userId: number,
    instrumentId: number,
    client?: PoolClient
  ): Promise<number>;

  /**
   * Calculate user's available cash
   * Includes CASH_IN/CASH_OUT and BUY/SELL impacts
   * Returns string to preserve precision - caller should use Decimal.js
   * @param userId - The user's ID
   * @param arsInstrumentId - The ARS currency instrument ID
   * @param client - Optional PoolClient for transaction support
   * @returns Promise resolving to cash amount as string (for precision)
   */
  getUserAvailableCash(
    userId: number,
    arsInstrumentId: number,
    client?: PoolClient
  ): Promise<string>;

  /**
   * Get orders for a user with cursor pagination
   * @param userId - The user's ID
   * @param limit - Number of orders to return (default: 50)
   * @param cursor - ISO timestamp cursor for pagination
   * @returns Promise resolving to paginated orders with cursor metadata
   */
  getOrdersByUserId(
    userId: number,
    limit?: number,
    cursor?: string
  ): Promise<{ orders: Order[]; nextCursor: string | null; hasMore: boolean }>;

  /**
   * Update the status of an order
   * Used for cancelling orders
   * @param orderId - The order's ID
   * @param status - The new status
   * @returns Promise resolving to updated OrderWithInstrument
   */
  updateOrderStatus(
    orderId: number,
    status: string
  ): Promise<OrderWithInstrument>;
}
