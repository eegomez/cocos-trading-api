/**
 * Mock Repository Factories
 * Helper functions to create mocked repository implementations for testing
 */

import {
  IUserRepository,
  IInstrumentRepository,
  IMarketDataRepository,
  IOrderRepository,
} from '@/repositories/interfaces';

/**
 * Create a fully mocked UserRepository
 * All methods are jest.fn() and can be configured with .mockResolvedValue()
 */
export function createMockUserRepository(): jest.Mocked<IUserRepository> {
  return {
    findUserById: jest.fn(),
  };
}

/**
 * Create a fully mocked InstrumentRepository
 * All methods are jest.fn() and can be configured with .mockResolvedValue()
 */
export function createMockInstrumentRepository(): jest.Mocked<IInstrumentRepository> {
  return {
    findInstrumentById: jest.fn(),
    findInstrumentsByIds: jest.fn(),
    searchStockInstruments: jest.fn(),
  };
}

/**
 * Create a fully mocked MarketDataRepository
 * All methods are jest.fn() and can be configured with .mockResolvedValue()
 */
export function createMockMarketDataRepository(): jest.Mocked<IMarketDataRepository> {
  return {
    getLatestMarketDataForInstrument: jest.fn(),
    getLatestMarketDataForInstruments: jest.fn(),
  };
}

/**
 * Create a fully mocked OrderRepository
 * All methods are jest.fn() and can be configured with .mockResolvedValue()
 */
export function createMockOrderRepository(): jest.Mocked<IOrderRepository> {
  return {
    createOrder: jest.fn(),
    findOrderById: jest.fn(),
    getFilledOrdersByUserId: jest.fn(),
    getUserPositionForInstrument: jest.fn(),
    getUserAvailableCash: jest.fn(),
    getOrdersByUserId: jest.fn(),
    updateOrderStatus: jest.fn(),
  };
}
