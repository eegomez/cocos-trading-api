/**
 * Dependency Container
 * Instantiates and wires all repositories and services
 *
 * This is the single source of truth for dependency injection.
 * All concrete implementations are created here and injected into services.
 */

// Repository implementations
import { UserRepository } from '@/repositories/user.repository';
import { InstrumentRepository } from '@/repositories/instrument.repository';
import { MarketDataRepository } from '@/repositories/marketdata.repository';
import { OrderRepository } from '@/repositories/order.repository';

// Service implementations
import { OrderService } from '@/services/order.service';
import { PortfolioService } from '@/services/portfolio.service';
import { InstrumentService } from '@/services/instrument.service';

// ============================================================================
// REPOSITORIES
// ============================================================================

export const userRepository = new UserRepository();
export const instrumentRepository = new InstrumentRepository();
export const marketDataRepository = new MarketDataRepository();
export const orderRepository = new OrderRepository();

// ============================================================================
// SERVICES
// ============================================================================

/**
 * Order Service
 * Handles order execution, validation, and retrieval
 */
export const orderService = new OrderService(
  userRepository,
  instrumentRepository,
  marketDataRepository,
  orderRepository
);

/**
 * Portfolio Service
 * Calculates user portfolio positions and balances
 */
export const portfolioService = new PortfolioService(
  userRepository,
  orderRepository,
  marketDataRepository,
  instrumentRepository
);

/**
 * Instrument Service
 * Handles instrument search and retrieval
 */
export const instrumentService = new InstrumentService(instrumentRepository);
