import Decimal from 'decimal.js';
import { Portfolio, Position, PositionCalculation } from '@/models';
import { ARS_INSTRUMENT_ID } from '@/constants/instruments';
import { NotFoundError } from '@/errors';
import { logger } from '@/adapters/logging/LoggerFactory';
import {
  IUserRepository,
  IOrderRepository,
  IMarketDataRepository,
  IInstrumentRepository,
} from '@/repositories/interfaces';

/**
 * Portfolio Service
 * Business logic for portfolio calculations
 */
export class PortfolioService {
  constructor(
    private userRepo: IUserRepository,
    private orderRepo: IOrderRepository,
    private marketDataRepo: IMarketDataRepository,
    private instrumentRepo: IInstrumentRepository
  ) {}

  /**
   * Get user's complete portfolio
   *
   * @param userId - User ID
   * @returns Portfolio with positions and available cash
   */
  async getUserPortfolio(userId: number): Promise<Portfolio> {
    const user = await this.userRepo.findUserById(userId);
    if (!user) {
      logger.warn({ userId }, 'Portfolio retrieval failed: user not found');
      throw new NotFoundError(`User with ID ${userId} not found`);
    }

    const orders = await this.orderRepo.getFilledOrdersByUserId(userId);

    const availableCashStr = await this.orderRepo.getUserAvailableCash(
      userId,
      ARS_INSTRUMENT_ID
    );
    // CRITICAL: Use Decimal for financial precision, not parseFloat
    // parseFloat causes precision loss (e.g., 0.1 + 0.2 !== 0.3 in JavaScript)
    const availableCash = new Decimal(availableCashStr);

    logger.debug(
      { userId, orderCount: orders.length, availableCash: availableCash.toString() },
      'Portfolio calculation started'
    );

    const stockOrders = orders.filter((o) => o.instrumentId !== ARS_INSTRUMENT_ID);
    const positionCalculations = this.calculatePositions(stockOrders);

    if (positionCalculations.size === 0) {
      return {
        userId,
        totalBalance: availableCash.toNumber(),
        availableCash: availableCash.toNumber(),
        positions: [],
      };
    }

    const instrumentIds = Array.from(positionCalculations.keys());
    const marketDataMap = await this.marketDataRepo.getLatestMarketDataForInstruments(
      instrumentIds
    );

    const instruments = await this.instrumentRepo.findInstrumentsByIds(instrumentIds);
    const instrumentMap = new Map(instruments.map((i) => [i.id, i]));

    const enrichedPositions = this.enrichPositions(
      positionCalculations,
      marketDataMap,
      instrumentMap
    );

    const portfolioValue = enrichedPositions.reduce(
      (sum, p) => new Decimal(sum).plus(p.marketValue).toNumber(),
      0
    );
    // availableCash is already a Decimal, no need to wrap again
    const totalBalance = availableCash.plus(portfolioValue).toNumber();

    return {
      userId,
      totalBalance,
      availableCash: availableCash.toNumber(),
      positions: enrichedPositions,
    };
  }

  /**
   * Calculate positions from orders
   * Tracks quantity and total cost for each instrument
   */
  private calculatePositions(
    orders: Array<{ instrumentId: number; side: string; size: number; price: string }>
  ): Map<number, PositionCalculation> {
    // Use Decimal internally to avoid precision loss
    const internalMap = new Map<
      number,
      { instrumentId: number; quantity: number; totalCost: Decimal }
    >();

    for (const order of orders) {
      if (!internalMap.has(order.instrumentId)) {
        internalMap.set(order.instrumentId, {
          instrumentId: order.instrumentId,
          quantity: 0,
          totalCost: new Decimal(0),
        });
      }

      const position = internalMap.get(order.instrumentId)!;

      if (order.side === 'BUY') {
        // BUY: Add shares and cost
        position.quantity += order.size;
        position.totalCost = position.totalCost.plus(
          new Decimal(order.size).times(order.price)
        );
      } else if (order.side === 'SELL') {
        // SELL: Reduce shares and cost proportionally
        // Guard against division by zero (shouldn't happen with valid data)
        if (position.quantity === 0) {
          logger.warn(
            { instrumentId: order.instrumentId },
            'Attempting to sell from zero position - data inconsistency detected'
          );
          continue;
        }
        const avgCost = position.totalCost.dividedBy(position.quantity);
        position.quantity -= order.size;
        position.totalCost = position.totalCost.minus(
          new Decimal(order.size).times(avgCost)
        );
      }
    }

    // Convert Decimal to number only at the final step
    const positionMap = new Map<number, PositionCalculation>();
    for (const [instrumentId, pos] of internalMap.entries()) {
      if (pos.quantity > 0) {
        positionMap.set(instrumentId, {
          instrumentId: pos.instrumentId,
          quantity: pos.quantity,
          totalCost: pos.totalCost.toNumber(),
        });
      }
    }

    return positionMap;
  }

  /**
   * Enrich positions with market data and calculate returns
   */
  private enrichPositions(
    positionCalculations: Map<number, PositionCalculation>,
    marketDataMap: Map<number, { close: string; previousClose: string }>,
    instrumentMap: Map<number, { ticker: string; name: string }>
  ): Position[] {
    const positions: Position[] = [];

    for (const [instrumentId, calculation] of positionCalculations.entries()) {
      const marketData = marketDataMap.get(instrumentId);
      const instrument = instrumentMap.get(instrumentId);

      // Skip if missing data
      if (!marketData || !instrument) {
        logger.warn(
          { instrumentId, hasMarketData: !!marketData, hasInstrument: !!instrument },
          'Skipping position due to missing market data or instrument details'
        );
        continue;
      }

      const currentPrice = marketData.close;
      const previousPrice = marketData.previousClose;

      // Calculate values using Decimal for precision
      const marketValue = new Decimal(calculation.quantity)
        .times(currentPrice)
        .toNumber();

      const averageBuyPrice = new Decimal(calculation.totalCost)
        .dividedBy(calculation.quantity)
        .toNumber();

      // Total return percentage (vs cost basis)
      const totalReturn =
        averageBuyPrice > 0
          ? new Decimal(currentPrice)
              .minus(averageBuyPrice)
              .dividedBy(averageBuyPrice)
              .times(100)
              .toDecimalPlaces(2)
              .toNumber()
          : 0;

      // Daily return percentage (vs previous close)
      const dailyReturn =
        new Decimal(previousPrice).greaterThan(0)
          ? new Decimal(currentPrice)
              .minus(previousPrice)
              .dividedBy(previousPrice)
              .times(100)
              .toDecimalPlaces(2)
              .toNumber()
          : 0;

      positions.push({
        instrumentId,
        ticker: instrument.ticker,
        name: instrument.name,
        quantity: calculation.quantity,
        averageBuyPrice: new Decimal(averageBuyPrice).toDecimalPlaces(2).toNumber(),
        currentPrice: new Decimal(currentPrice).toDecimalPlaces(2).toNumber(),
        marketValue: new Decimal(marketValue).toDecimalPlaces(2).toNumber(),
        totalReturn,
        dailyReturn,
      });
    }

    // Sort by market value descending
    return positions.sort((a, b) => b.marketValue - a.marketValue);
  }
}
