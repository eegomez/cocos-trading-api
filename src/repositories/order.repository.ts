import { PoolClient } from 'pg';
import { query } from '@/config/database';
import { Order, OrderWithInstrument } from '@/models';
import { ORDER_STATUSES } from '@/constants/instruments';
import { IOrderRepository } from './interfaces/IOrderRepository';
import { NotFoundError } from '@/errors';

/**
 * Order Repository
 * Handles all database operations for orders
 */
export class OrderRepository implements IOrderRepository {
  /**
   * Create a new order
   * Can be called within a transaction by passing a client
   */
  async createOrder(
    orderData: {
      instrumentId: number;
      userId: number;
      size: number;
      price: number | string; // Accept both number and string (PostgreSQL NUMERIC accepts both)
      type: string;
      side: string;
      status: string;
    },
    client?: PoolClient
  ): Promise<Order> {
    const queryFn = client ? client.query.bind(client) : query;

    const result = await queryFn<Order>(
      `
      INSERT INTO orders (
        instrumentid,
        userid,
        size,
        price,
        type,
        side,
        status,
        datetime
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING
        id,
        instrumentid AS "instrumentId",
        userid AS "userId",
        size,
        price::numeric,
        type,
        side,
        status,
        datetime
      `,
      [
        orderData.instrumentId,
        orderData.userId,
        orderData.size,
        orderData.price,
        orderData.type,
        orderData.side,
        orderData.status,
      ]
    );

    const row = result.rows[0]!;
    // size is INTEGER (already number), price is NUMERIC (string for precision)
    return row;
  }

  /**
   * Find order by ID
   */
  async findOrderById(orderId: number): Promise<OrderWithInstrument | null> {
    const result = await query<OrderWithInstrument>(
      `
      SELECT
        o.id,
        o.instrumentid AS "instrumentId",
        o.userid AS "userId",
        o.size,
        o.price,
        o.type,
        o.side,
        o.status,
        o.datetime,
        i.ticker,
        i.name
      FROM orders o
      JOIN instruments i ON o.instrumentid = i.id
      WHERE o.id = $1
      `,
      [orderId]
    );

    const row = result.rows[0];
    if (!row) return null;

    // size is INTEGER (already number), price is NUMERIC (string for precision)
    return row;
  }

  /**
   * Get all FILLED orders for a user
   * Used for portfolio calculations
   */
  async getFilledOrdersByUserId(
    userId: number,
    client?: PoolClient
  ): Promise<Order[]> {
    const queryFn = client ? client.query.bind(client) : query;

    const result = await queryFn<Order>(
      `
      SELECT
        id,
        instrumentid AS "instrumentId",
        userid AS "userId",
        size,
        price,
        type,
        side,
        status,
        datetime
      FROM orders
      WHERE userid = $1 AND status = $2
      ORDER BY datetime ASC
      `,
      [userId, ORDER_STATUSES.FILLED]
    );

    // size is INTEGER (already number), price is NUMERIC (string for precision)
    return result.rows;
  }

  /**
   * Get user's position for a specific instrument
   * Calculates net shares from FILLED BUY and SELL orders
   * Uses FOR UPDATE when called within a transaction to prevent race conditions
   */
  async getUserPositionForInstrument(
    userId: number,
    instrumentId: number,
    client?: PoolClient
  ): Promise<number> {
    const queryFn = client ? client.query.bind(client) : query;

    // When in transaction, use subquery with FOR UPDATE to lock rows before aggregating
    const result = await queryFn<{ position: string }>(
      client
        ? `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN side = 'BUY' THEN size
              WHEN side = 'SELL' THEN -size
              ELSE 0
            END
          ),
          0
        ) as position
      FROM (
        SELECT * FROM orders
        WHERE userid = $1
          AND instrumentid = $2
          AND status = $3
          AND side IN ('BUY', 'SELL')
        FOR UPDATE
      ) orders
      `
        : `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN side = 'BUY' THEN size
              WHEN side = 'SELL' THEN -size
              ELSE 0
            END
          ),
          0
        ) as position
      FROM orders
      WHERE userid = $1
        AND instrumentid = $2
        AND status = $3
        AND side IN ('BUY', 'SELL')
      `,
      [userId, instrumentId, ORDER_STATUSES.FILLED]
    );

    return parseInt(result.rows[0]?.position || '0', 10);
  }

  /**
   * Calculate user's available cash
   * Includes CASH_IN/CASH_OUT and BUY/SELL impacts
   * Returns string to preserve precision - caller should use Decimal.js
   * Uses FOR UPDATE when called within a transaction to prevent race conditions
   */
  async getUserAvailableCash(
    userId: number,
    arsInstrumentId: number,
    client?: PoolClient
  ): Promise<string> {
    const queryFn = client ? client.query.bind(client) : query;

    // When in transaction, use subquery with FOR UPDATE to lock rows before aggregating
    const result = await queryFn<{ cash: string }>(
      client
        ? `
      SELECT
        COALESCE(
          SUM(
            CASE
              -- CASH_IN adds to cash
              WHEN instrumentid = $2 AND side = 'CASH_IN' THEN size * price
              -- CASH_OUT subtracts from cash
              WHEN instrumentid = $2 AND side = 'CASH_OUT' THEN -size * price
              -- BUY subtracts from cash
              WHEN side = 'BUY' THEN -size * price
              -- SELL adds to cash
              WHEN side = 'SELL' THEN size * price
              ELSE 0
            END
          ),
          0
        ) as cash
      FROM (
        SELECT * FROM orders
        WHERE userid = $1 AND status = $3
        FOR UPDATE
      ) orders
      `
        : `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN instrumentid = $2 AND side = 'CASH_IN' THEN size * price
              WHEN instrumentid = $2 AND side = 'CASH_OUT' THEN -size * price
              WHEN side = 'BUY' THEN -size * price
              WHEN side = 'SELL' THEN size * price
              ELSE 0
            END
          ),
          0
        ) as cash
      FROM orders
      WHERE userid = $1 AND status = $3
      `,
      [userId, arsInstrumentId, ORDER_STATUSES.FILLED]
    );

    return result.rows[0]?.cash || '0';
  }

  /**
   * Get orders for a user with cursor pagination
   *
   * Uses cursor-based pagination for better performance with large datasets:
   * - Cursor = datetime of last order in previous page
   * - Consistent results even when new orders are added
   * - Fast at any depth (no OFFSET scanning)
   *
   * Why cursor over offset pagination:
   * - Offset: SELECT ... OFFSET 10000 LIMIT 50 → Scans 10,000 rows!
   * - Cursor: SELECT ... WHERE datetime < $cursor LIMIT 50 → Uses index!
   *
   * @param userId - User ID
   * @param limit - Number of orders to return (default: 50, max: 200)
   * @param cursor - ISO timestamp of last order from previous page
   * @returns Orders and next cursor for pagination
   */
  async getOrdersByUserId(
    userId: number,
    limit: number = 50,
    cursor?: string
  ): Promise<{ orders: Order[]; nextCursor: string | null; hasMore: boolean }> {
    // Cap limit to prevent abuse
    const safeLimit = Math.min(limit, 200);

    const result = await query<Order>(
      `
      SELECT
        id,
        instrumentid AS "instrumentId",
        userid AS "userId",
        size,
        price,
        type,
        side,
        status,
        datetime
      FROM orders
      WHERE userid = $1
        ${cursor ? 'AND datetime < $3' : ''}
      ORDER BY datetime DESC
      LIMIT $2
      `,
      cursor ? [userId, safeLimit + 1, cursor] : [userId, safeLimit + 1]
    );

    const orders = result.rows;
    const hasMore = orders.length > safeLimit;

    // Remove extra row used to check hasMore
    if (hasMore) {
      orders.pop();
    }

    // Next cursor is the datetime of the last order
    const nextCursor =
      hasMore && orders.length > 0
        ? orders[orders.length - 1]!.datetime.toISOString()
        : null;

    return {
      orders,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Update the status of an order
   * Used for cancelling orders
   *
   * PostgreSQL returns column names in lowercase (instrumentid, userid), but
   * TypeScript expects camelCase (instrumentId, userId). We must explicitly
   * alias columns in the RETURNING clause to match our interface.
   *
   * Without aliasing, order.instrumentId would be undefined, causing the
   * instrument lookup to fail or fetch wrong data.
   */
  async updateOrderStatus(
    orderId: number,
    status: string
  ): Promise<OrderWithInstrument> {
    // Explicitly alias columns to match TypeScript interface
    const result = await query<Order>(
      `UPDATE orders
       SET status = $2
       WHERE id = $1
       RETURNING
         id,
         instrumentid AS "instrumentId",
         userid AS "userId",
         size,
         price,
         type,
         side,
         status,
         datetime`,
      [orderId, status]
    );

    // Safety check: order must exist (update affected rows)
    if (result.rows.length === 0) {
      throw new NotFoundError(`Order with ID ${orderId} not found`);
    }

    const order = result.rows[0]!; // Non-null after check above

    // Get instrument details (JOIN would be better but keeping simple for now)
    const instrumentResult = await query<{ ticker: string; name: string }>(
      `SELECT ticker, name FROM instruments WHERE id = $1`,
      [order.instrumentId]
    );

    // Safety check - use NotFoundError for missing instrument
    // Note: This should never happen due to foreign key constraint, but check anyway
    if (instrumentResult.rows.length === 0) {
      throw new NotFoundError(
        `Instrument with ID ${order.instrumentId} not found (referential integrity violation)`
      );
    }

    const instrument = instrumentResult.rows[0]!; // Non-null after check above

    return {
      ...order,
      ticker: instrument.ticker,
      name: instrument.name,
    } as OrderWithInstrument; // Type assertion: order has all required fields
  }
}
