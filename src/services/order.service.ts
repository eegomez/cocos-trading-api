import Decimal from 'decimal.js';
import { PoolClient } from 'pg';
import { transaction } from '@/config/database';
import { Order, OrderWithInstrument, CreateOrderInput } from '@/models';
import {
  ARS_INSTRUMENT_ID,
  ORDER_TYPES,
  ORDER_SIDES,
  ORDER_STATUSES,
} from '@/constants/instruments';
import { NotFoundError, BusinessRuleError } from '@/errors';
import { logger } from '@/adapters/logging/LoggerFactory';
import {
  IUserRepository,
  IInstrumentRepository,
  IMarketDataRepository,
  IOrderRepository,
} from '@/repositories/interfaces';

/**
 * Order Service
 * Business logic for order execution and validation
 */
export class OrderService {
  constructor(
    private userRepo: IUserRepository,
    private instrumentRepo: IInstrumentRepository,
    private marketDataRepo: IMarketDataRepository,
    private orderRepo: IOrderRepository
  ) {}

  /**
   * Execute an order (MARKET or LIMIT)
   *
   * Business Rules:
   * - MARKET orders execute immediately (status: FILLED)
   * - LIMIT orders are placed for future execution (status: NEW)
   * - BUY orders require sufficient cash
   * - SELL orders require sufficient shares
   * - Invalid orders are saved with status: REJECTED
   *
   * ============================================
   * IDEMPOTENCY SUPPORT (Not Yet Implemented)
   * ============================================
   *
   * Problem: Network retries can create duplicate orders
   * - User clicks "Buy" → Request sent
   * - Network timeout → User sees error
   * - User clicks "Buy" again → Duplicate order!
   *
   * Solution: Client-Generated Idempotency Keys
   * - Client generates UUID when user initiates action
   * - Client sends UUID in header: Idempotency-Key: "550e8400-..."
   * - Server checks if order with this key exists
   * - If exists: Return existing order (idempotent!)
   * - If not: Create order, store key mapping
   *
   * Implementation Options:
   *
   * Option 1: PostgreSQL Table (Recommended for MVP)
   * ```typescript
   * if (idempotencyKey) {
   *   const existing = await query(
   *     'SELECT order_id FROM idempotency_keys WHERE key = $1',
   *     [idempotencyKey]
   *   );
   *   if (existing.rows[0]) {
   *     return await findOrderById(existing.rows[0].order_id);
   *   }
   * }
   * // ... create order ...
   * // Store mapping:
   * await query(
   *   'INSERT INTO idempotency_keys (key, order_id) VALUES ($1, $2)',
   *   [idempotencyKey, order.id]
   * );
   * ```
   * Pros: Simple, no extra infrastructure
   * Cons: Need cleanup job for expired keys (24h TTL)
   *
   * Option 2: Redis (Recommended for Production)
   * ```typescript
   * if (idempotencyKey) {
   *   const orderId = await redis.get(`idempotency:${idempotencyKey}`);
   *   if (orderId) {
   *     return await findOrderById(parseInt(orderId));
   *   }
   * }
   * // ... create order ...
   * // Store with automatic TTL:
   * await redis.set(`idempotency:${idempotencyKey}`, order.id, 'EX', 86400);
   * ```
   * Pros: Automatic TTL, extremely fast (~1ms)
   * Cons: Requires Redis infrastructure
   *
   * See: database/migrations/001_add_idempotency_keys.sql
   * See: docs/IDEMPOTENCY.md
   *
   * @param input - Order creation input
   * @returns Formatted response with order and totalAmount
   */
  async executeOrder(input: CreateOrderInput): Promise<{
    success: boolean;
    order: Order & { totalAmount: number };
  }> {
    return await transaction(async (client) => {
      // 1. Validate user exists
      const user = await this.userRepo.findUserById(input.userId);
      if (!user) {
        logger.warn({ userId: input.userId }, 'Order rejected: user not found');
        throw new NotFoundError(`User with ID ${input.userId} not found`);
      }

      // 2. Validate instrument exists
      const instrument = await this.instrumentRepo.findInstrumentById(input.instrumentId);
      if (!instrument) {
        logger.warn(
          { instrumentId: input.instrumentId, userId: input.userId },
          'Order rejected: instrument not found'
        );
        throw new NotFoundError(
          `Instrument with ID ${input.instrumentId} not found`
        );
      }

      // 3. Handle CASH_IN/CASH_OUT operations (special case)
      //
      // Cash operations are modeled as orders but don't require market data
      // since ARS (currency) doesn't trade on exchanges. They execute immediately.
      if (input.side === ORDER_SIDES.CASH_IN || input.side === ORDER_SIDES.CASH_OUT) {
        return await this.executeCashOperation(input, client);
      }

      // 4. Get current market price (for stock orders only)
      //
      // RACE CONDITION CONSIDERATION - Market Data Staleness:
      //
      // Market data is fetched OUTSIDE of row-level locks (FOR UPDATE only locks order rows).
      // This means concurrent orders may execute at slightly stale prices.
      //
      // Scenario:
      // - Order A reads market price: $100 (at 10:00:00.000)
      // - Order B reads market price: $100 (at 10:00:00.050)
      // - Market data updates to $110  (at 10:00:00.100)
      // - Both orders execute at $100 (stale price)
      //
      // Why this is ACCEPTABLE (eventual consistency):
      // 1. Real markets have inherent latency (network, processing)
      // 2. MARKET orders accept "current market price" - small staleness is expected
      // 3. Locking market data would serialize ALL orders (massive performance hit)
      // 4. Price staleness window is milliseconds (acceptable for retail trading)
      //
      // Mitigation:
      // - Audit log includes market data timestamp for compliance/debugging
      // - Market data refresh rate is high (real-time or near-real-time)
      // - LIMIT orders protect against price execution risk
      //
      // Alternative approaches considered:
      // - Option A: Lock market data rows (rejected - serializes all orders, huge bottleneck)
      // - Option B: Optimistic locking with version check (rejected - complex, marginal benefit)
      // - Option C: Accept eventual consistency (CHOSEN - standard in financial systems)
      const marketData = await this.marketDataRepo.getLatestMarketDataForInstrument(
        input.instrumentId
      );

      if (!marketData && input.type === ORDER_TYPES.MARKET) {
        logger.error(
          { instrumentId: input.instrumentId, ticker: instrument.ticker },
          'MARKET order failed: no market data available'
        );
        throw new BusinessRuleError(
          `No market data available for instrument ${instrument.ticker}`
        );
      }

      // 5. Determine execution price
      //
      // P0-5: Use string as canonical type for monetary values
      // Why: PostgreSQL NUMERIC returns string to preserve precision
      // Converting to number risks precision loss for large values
      // String → Decimal.js for arithmetic ensures exact calculations
      let executionPrice: string;
      if (input.type === ORDER_TYPES.MARKET) {
        // Keep as string from PostgreSQL NUMERIC - no conversion needed
        executionPrice = marketData!.close;

        // Audit log: Record market data timestamp for compliance/debugging
        // Helps identify price staleness issues if they occur
        logger.debug(
          {
            userId: input.userId,
            instrumentId: input.instrumentId,
            ticker: instrument.ticker,
            executionPrice,
            marketDataDate: marketData!.date,
            orderType: input.type,
          },
          'MARKET order using market data price'
        );
      } else {
        // LIMIT order - ensure it's a string
        executionPrice = String(input.price);
      }

      // 6. Calculate order size (shares)
      let orderSize: number;
      if (input.size !== undefined) {
        // User specified exact shares
        orderSize = input.size;
      } else {
        // User specified amount (ARS), calculate shares
        // Floor to prevent fractional shares
        orderSize = new Decimal(input.amount!).dividedBy(executionPrice).floor().toNumber();

        if (orderSize === 0) {
          // Amount too small to buy even 1 share
          const rejectedOrder = await this.orderRepo.createOrder(
            {
              instrumentId: input.instrumentId,
              userId: input.userId,
              size: 0,
              price: executionPrice,
              type: input.type,
              side: input.side,
              status: ORDER_STATUSES.REJECTED,
            },
            client
          );

          logger.warn(
            {
              orderId: rejectedOrder.id,
              amount: input.amount,
              price: executionPrice,
            },
            'Order rejected: amount too small to purchase shares'
          );

          return {
            success: true,
            order: {
              ...rejectedOrder,
              totalAmount: new Decimal(rejectedOrder.size)
                .times(rejectedOrder.price)
                .toDecimalPlaces(2)
                .toNumber(),
            },
          };
        }
      }

      // 7. Validate order (check funds/shares)
      const validationError = await this.validateOrder(
        {
          userId: input.userId,
          instrumentId: input.instrumentId,
          side: input.side,
          size: orderSize,
          price: executionPrice,
        },
        client
      );

      if (validationError) {
        // Save as REJECTED
        const rejectedOrder = await this.orderRepo.createOrder(
          {
            instrumentId: input.instrumentId,
            userId: input.userId,
            size: orderSize,
            price: executionPrice,
            type: input.type,
            side: input.side,
            status: ORDER_STATUSES.REJECTED,
          },
          client
        );

        logger.warn(
          {
            orderId: rejectedOrder.id,
            reason: validationError,
          },
          'Order rejected'
        );

        return {
          success: true,
          order: {
            ...rejectedOrder,
            totalAmount: new Decimal(rejectedOrder.size)
              .times(rejectedOrder.price)
              .toDecimalPlaces(2)
              .toNumber(),
          },
        };
      }

      // 8. Determine order status
      let orderStatus: string;
      if (input.type === ORDER_TYPES.MARKET) {
        // MARKET orders execute immediately
        orderStatus = ORDER_STATUSES.FILLED;
      } else {
        // LIMIT orders are placed for future execution
        orderStatus = ORDER_STATUSES.NEW;

        /**
         * KNOWN LIMITATION (P0-3): LIMIT Order Cash Not Reserved
         *
         * Problem:
         * When a LIMIT BUY order is created (status=NEW), we check if the user
         * has sufficient cash (see validateOrder above), but we DO NOT reserve
         * that cash. The user can then create multiple pending LIMIT orders with
         * the same cash, and when they all fill, the account goes negative.
         *
         * Example:
         * - User has 10,000 ARS
         * - Creates LIMIT BUY for 10 shares @ 1000 ARS each (needs 10,000)
         * - Validation passes ✓
         * - Creates another LIMIT BUY for 10 shares @ 1000 ARS (needs 10,000)
         * - Validation passes ✓ (because we only check filled orders, not pending)
         * - Both orders fill → user owes 20,000 ARS but only had 10,000 ❌
         *
         * Solution Options:
         *
         * Option 1: Reserve Cash in Database (Recommended)
         * - Add `reserved_cash` column to track pending LIMIT order commitments
         * - Update getUserAvailableCash to subtract reserved cash
         * - See: database/migrations/002_add_reserved_cash.sql
         *
         * Option 2: Check Pending Orders in Available Cash Calculation
         * - Modify getUserAvailableCash query to sum pending NEW orders:
         *   WHEN side = 'BUY' AND status = 'NEW' THEN -(size * CAST(price AS NUMERIC))
         * - Simpler but less explicit than Option 1
         *
         * Current Mitigation:
         * - For MVP/demo, risk is acceptable (single user, manual testing)
         * - Add monitoring alert if cash balance goes negative
         * - Implement proper solution before production launch
         */
      }

      // 9. Create order
      const order = await this.orderRepo.createOrder(
        {
          instrumentId: input.instrumentId,
          userId: input.userId,
          size: orderSize,
          price: executionPrice,
          type: input.type,
          side: input.side,
          status: orderStatus,
        },
        client
      );

      logger.info(
        {
          orderId: order.id,
          userId: order.userId,
          side: order.side,
          type: order.type,
          status: order.status,
          size: order.size,
          price: order.price,
        },
        'Order executed'
      );

      // Format response with calculated totalAmount
      return {
        success: true,
        order: {
          id: order.id,
          userId: order.userId,
          instrumentId: order.instrumentId,
          side: order.side,
          type: order.type,
          status: order.status,
          size: order.size,
          price: order.price,
          totalAmount: new Decimal(order.size)
            .times(order.price)
            .toDecimalPlaces(2)
            .toNumber(),
          datetime: order.datetime,
        },
      };
    });
  }

  /**
   * Validate order business rules for stock orders (BUY/SELL)
   *
   * Note: CASH_IN/CASH_OUT operations are handled separately
   * in executeCashOperation() and never reach this method.
   *
   * @returns Error message if invalid, null if valid
   */
  private async validateOrder(
    orderData: {
      userId: number;
      instrumentId: number;
      side: string;
      size: number;
      price: number | string; // Accept both number and string (Decimal.js handles both)
    },
    client: PoolClient
  ): Promise<string | null> {
    if (orderData.side === ORDER_SIDES.BUY) {
      // Validate sufficient cash
      const availableCash = await this.orderRepo.getUserAvailableCash(
        orderData.userId,
        ARS_INSTRUMENT_ID,
        client
      );

      const orderCost = new Decimal(orderData.size).times(orderData.price);

      if (new Decimal(availableCash).lessThan(orderCost)) {
        logger.warn(
          {
            userId: orderData.userId,
            instrumentId: orderData.instrumentId,
            availableCash,
            requiredAmount: orderCost.toString(),
          },
          'Order validation failed: insufficient funds'
        );
        return `Insufficient funds: available ${availableCash} ARS, required ${orderCost.toString()} ARS`;
      }
    } else if (orderData.side === ORDER_SIDES.SELL) {
      // Validate sufficient shares
      const currentPosition = await this.orderRepo.getUserPositionForInstrument(
        orderData.userId,
        orderData.instrumentId,
        client
      );

      if (currentPosition < orderData.size) {
        logger.warn(
          {
            userId: orderData.userId,
            instrumentId: orderData.instrumentId,
            availableShares: currentPosition,
            requestedShares: orderData.size,
          },
          'Order validation failed: insufficient shares'
        );
        return `Insufficient shares: available ${currentPosition}, trying to sell ${orderData.size}`;
      }
    }
    // Note: CASH_IN/CASH_OUT validation removed - handled in executeCashOperation()

    return null;
  }

  /**
   * Get order by ID
   *
   * @param orderId - Order ID
   * @returns Order with instrument details and totalAmount
   */
  async getOrderById(orderId: number): Promise<
    OrderWithInstrument & { totalAmount: number }
  > {
    const order = await this.orderRepo.findOrderById(orderId);

    if (!order) {
      throw new NotFoundError(`Order with ID ${orderId} not found`);
    }

    return {
      ...order,
      totalAmount: new Decimal(order.size)
        .times(order.price)
        .toDecimalPlaces(2)
        .toNumber(),
    };
  }

  /**
   * Get orders for a user with cursor pagination
   *
   * @param userId - User ID
   * @param limit - Number of orders to return (default: 50)
   * @param cursor - Cursor for pagination (ISO timestamp)
   * @returns Formatted response with paginated orders and cursor metadata
   */
  async getUserOrders(
    userId: number,
    limit?: number,
    cursor?: string
  ): Promise<{
    success: boolean;
    orders: Array<Order & { totalAmount: number }>;
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const user = await this.userRepo.findUserById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found`);
    }

    const result = await this.orderRepo.getOrdersByUserId(userId, limit, cursor);

    return {
      success: true,
      orders: result.orders.map((order) => ({
        id: order.id,
        userId: order.userId,
        instrumentId: order.instrumentId,
        side: order.side,
        type: order.type,
        status: order.status,
        size: order.size,
        price: order.price,
        totalAmount: new Decimal(order.size)
          .times(order.price)
          .toDecimalPlaces(2)
          .toNumber(),
        datetime: order.datetime,
      })),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  /**
   * Cancel an order
   *
   * Business Rules:
   * - Only NEW orders can be cancelled
   * - FILLED orders cannot be cancelled (already executed)
   * - REJECTED orders cannot be cancelled (already invalid)
   * - CANCELLED orders cannot be cancelled (already cancelled)
   *
   * RACE CONDITION FIX (P0-1):
   * We wrap the entire operation in a transaction with FOR UPDATE lock to prevent
   * TOCTOU (time-of-check-time-of-use) bugs. Without this, two concurrent cancel
   * requests could both read status=NEW and both proceed, or worse, the order
   * could be filled by a background process between the check and update.
   *
   * The FOR UPDATE lock ensures no other transaction can modify the order row
   * until we commit or rollback, guaranteeing atomic read-check-update.
   *
   * @param orderId - Order ID to cancel
   * @param userId - User ID (for authorization)
   * @returns Cancelled order with totalAmount
   */
  async cancelOrder(
    orderId: number,
    userId: number
  ): Promise<{
    success: boolean;
    message: string;
    order: Order & { totalAmount: number };
  }> {
    return await transaction(async (client) => {
      // Lock the order row for the duration of the transaction (FOR UPDATE)
      // This prevents concurrent modifications while we check and update status
      const result = await client.query<Order>(
        `SELECT
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
         WHERE id = $1
         FOR UPDATE`,
        [orderId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError(`Order with ID ${orderId} not found`);
      }

      const existingOrder = result.rows[0]!; // Safe: verified rows.length > 0 above

      // Verify order belongs to user
      if (existingOrder.userId !== userId) {
        throw new BusinessRuleError('Order not found or not owned by user');
      }

      // Verify order is in NEW status
      if (existingOrder.status !== ORDER_STATUSES.NEW) {
        throw new BusinessRuleError(
          `Only NEW orders can be cancelled. Current status: ${existingOrder.status}`
        );
      }

      // Update order status to CANCELLED within the same transaction
      const updateResult = await client.query<Order>(
        `UPDATE orders
         SET status = $1
         WHERE id = $2
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
        [ORDER_STATUSES.CANCELLED, orderId]
      );

      const cancelledOrder = updateResult.rows[0]!;

      // Get instrument details for response
      const instrumentResult = await client.query<{ ticker: string; name: string }>(
        `SELECT ticker, name FROM instruments WHERE id = $1`,
        [cancelledOrder.instrumentId]
      );

      const instrument = instrumentResult.rows[0]!;

      logger.info(
        {
          orderId,
          userId,
          instrumentId: cancelledOrder.instrumentId,
        },
        'Order cancelled'
      );

      return {
        success: true,
        message: 'Order cancelled successfully',
        order: {
          ...cancelledOrder,
          ticker: instrument.ticker,
          name: instrument.name,
          totalAmount: new Decimal(cancelledOrder.size)
            .times(cancelledOrder.price)
            .toDecimalPlaces(2)
            .toNumber(),
        },
      };
    });
  }

  /**
   * Execute CASH_IN or CASH_OUT operation
   *
   * Cash operations are modeled as orders but have special handling:
   * - ARS instrument (ID 66) is required
   * - Price is always 1 (1 ARS = 1 ARS)
   * - Status is always FILLED (immediate execution)
   * - No market data required (ARS is a currency, not a traded asset)
   *
   * @param input - Order creation input
   * @param client - Database transaction client
   * @returns Formatted response with order and totalAmount
   */
  private async executeCashOperation(
    input: CreateOrderInput,
    client: PoolClient
  ): Promise<{
    success: boolean;
    order: Order & { totalAmount: number };
  }> {
    // Validate ARS instrument
    if (input.instrumentId !== ARS_INSTRUMENT_ID) {
      logger.warn(
        {
          side: input.side,
          instrumentId: input.instrumentId,
          userId: input.userId,
        },
        'Cash operation rejected: must use ARS instrument'
      );
      throw new BusinessRuleError(
        `${input.side} operations must use ARS instrument (ID ${ARS_INSTRUMENT_ID})`
      );
    }

    // Calculate order size (ARS amount)
    const orderSize = input.size ?? new Decimal(input.amount!).dividedBy(1).floor().toNumber();

    // Validate CASH_OUT has sufficient funds
    if (input.side === ORDER_SIDES.CASH_OUT) {
      const validationError = await this.validateCashOutFunds(
        input.userId,
        orderSize,
        client
      );

      if (validationError) {
        return validationError;
      }
    }

    // Create cash order with FILLED status (immediate execution)
    const order = await this.orderRepo.createOrder(
      {
        instrumentId: input.instrumentId,
        userId: input.userId,
        size: orderSize,
        price: '1', // ARS always has price 1
        type: input.type,
        side: input.side,
        status: ORDER_STATUSES.FILLED,
      },
      client
    );

    logger.info(
      {
        orderId: order.id,
        userId: order.userId,
        side: order.side,
        type: order.type,
        status: order.status,
        size: order.size,
        price: order.price,
      },
      'Cash operation executed'
    );

    return {
      success: true,
      order: {
        ...order,
        totalAmount: new Decimal(order.size)
          .times(order.price)
          .toDecimalPlaces(2)
          .toNumber(),
      },
    };
  }

  /**
   * Validate CASH_OUT operation has sufficient funds
   *
   * @param userId - User ID
   * @param orderSize - Amount to withdraw
   * @param client - Database transaction client
   * @returns Rejected order response if insufficient funds, null if valid
   */
  private async validateCashOutFunds(
    userId: number,
    orderSize: number,
    client: PoolClient
  ): Promise<{
    success: boolean;
    order: Order & { totalAmount: number };
  } | null> {
    const availableCash = await this.orderRepo.getUserAvailableCash(
      userId,
      ARS_INSTRUMENT_ID,
      client
    );

    const cashOutAmount = new Decimal(orderSize).times(1);

    if (new Decimal(availableCash).lessThan(cashOutAmount)) {
      // Save as REJECTED
      const rejectedOrder = await this.orderRepo.createOrder(
        {
          instrumentId: ARS_INSTRUMENT_ID,
          userId: userId,
          size: orderSize,
          price: '1',
          type: ORDER_TYPES.MARKET,
          side: ORDER_SIDES.CASH_OUT,
          status: ORDER_STATUSES.REJECTED,
        },
        client
      );

      logger.warn(
        {
          orderId: rejectedOrder.id,
          userId: userId,
          availableCash,
          requestedAmount: cashOutAmount.toString(),
        },
        'CASH_OUT rejected: insufficient funds'
      );

      return {
        success: true,
        order: {
          ...rejectedOrder,
          totalAmount: new Decimal(rejectedOrder.size)
            .times(rejectedOrder.price)
            .toDecimalPlaces(2)
            .toNumber(),
        },
      };
    }

    return null; // Validation passed
  }
}
