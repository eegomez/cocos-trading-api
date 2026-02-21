import { OrderService } from '@/services/order.service';
import {
  createMockUserRepository,
  createMockInstrumentRepository,
  createMockMarketDataRepository,
  createMockOrderRepository,
} from '@/tests/utils/mockRepositories';
import {
  IUserRepository,
  IInstrumentRepository,
  IMarketDataRepository,
  IOrderRepository,
} from '@/repositories/interfaces';
import { ORDER_TYPES, ORDER_SIDES, ORDER_STATUSES } from '@/constants/instruments';
import { NotFoundError, BusinessRuleError } from '@/errors';

// Mock the transaction function to execute callback immediately with a mock client
// P0-1: cancelOrder now uses transactions, so we need to mock client.query()
const mockClient = {
  query: jest.fn(),
};

jest.mock('@/config/database', () => ({
  transaction: jest.fn((callback) => callback(mockClient)),
}));

describe('OrderService', () => {
  let orderService: OrderService;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockInstrumentRepo: jest.Mocked<IInstrumentRepository>;
  let mockMarketDataRepo: jest.Mocked<IMarketDataRepository>;
  let mockOrderRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    mockUserRepo = createMockUserRepository();
    mockInstrumentRepo = createMockInstrumentRepository();
    mockMarketDataRepo = createMockMarketDataRepository();
    mockOrderRepo = createMockOrderRepository();

    orderService = new OrderService(
      mockUserRepo,
      mockInstrumentRepo,
      mockMarketDataRepo,
      mockOrderRepo
    );
  });

  describe('executeOrder', () => {
    it('should throw NotFoundError when user does not exist', async () => {
      mockUserRepo.findUserById.mockResolvedValue(null);

      const orderInput = {
        userId: 999,
        instrumentId: 34,
        side: ORDER_SIDES.BUY as any,
        type: ORDER_TYPES.MARKET as any,
        size: 1,
      };

      await expect(orderService.executeOrder(orderInput)).rejects.toThrow(
        NotFoundError
      );
      await expect(orderService.executeOrder(orderInput)).rejects.toThrow(
        'User with ID 999 not found'
      );
    });

    it('should throw NotFoundError when instrument does not exist', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockInstrumentRepo.findInstrumentById.mockResolvedValue(null);

      const orderInput = {
        userId: 1,
        instrumentId: 999,
        side: ORDER_SIDES.BUY as any,
        type: ORDER_TYPES.MARKET as any,
        size: 1,
      };

      await expect(orderService.executeOrder(orderInput)).rejects.toThrow(
        NotFoundError
      );
      await expect(orderService.executeOrder(orderInput)).rejects.toThrow(
        'Instrument with ID 999 not found'
      );
    });

    it('should throw BusinessRuleError when market data is missing for MARKET order', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockInstrumentRepo.findInstrumentById.mockResolvedValue({
        id: 34,
        ticker: 'AAPL',
        name: 'Apple Inc.',
        type: 'ACCIONES',
      });
      mockMarketDataRepo.getLatestMarketDataForInstrument.mockResolvedValue(null);

      const orderInput = {
        userId: 1,
        instrumentId: 34,
        side: ORDER_SIDES.BUY as any,
        type: ORDER_TYPES.MARKET as any,
        size: 1,
      };

      await expect(orderService.executeOrder(orderInput)).rejects.toThrow(
        BusinessRuleError
      );
      await expect(orderService.executeOrder(orderInput)).rejects.toThrow(
        'No market data available for instrument AAPL'
      );
    });

    it('should execute MARKET BUY order successfully when funds are sufficient', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockInstrumentRepo.findInstrumentById.mockResolvedValue({
        id: 34,
        ticker: 'AAPL',
        name: 'Apple Inc.',
        type: 'ACCIONES',
      });
      mockMarketDataRepo.getLatestMarketDataForInstrument.mockResolvedValue({
        instrumentId: 34,
        close: '150.00',
        previousClose: '148.00',
        date: new Date(),
      });
      mockOrderRepo.getUserAvailableCash.mockResolvedValue('10000.00');
      mockOrderRepo.getUserPositionForInstrument.mockResolvedValue(0);
      mockOrderRepo.createOrder.mockResolvedValue({
        id: 1,
        userId: 1,
        instrumentId: 34,
        size: 5,
        price: '150.00',
        type: ORDER_TYPES.MARKET,
        side: ORDER_SIDES.BUY,
        status: ORDER_STATUSES.FILLED,
        datetime: new Date(),
      });

      const orderInput = {
        userId: 1,
        instrumentId: 34,
        side: ORDER_SIDES.BUY as any,
        type: ORDER_TYPES.MARKET as any,
        size: 5,
      };

      const response = await orderService.executeOrder(orderInput);

      expect(response.success).toBe(true);
      expect(response.order.status).toBe(ORDER_STATUSES.FILLED);
      expect(response.order.side).toBe(ORDER_SIDES.BUY);
      expect(response.order.size).toBe(5);
      expect(response.order.price).toBe('150.00');
      expect(response.order.totalAmount).toBe(750);
      expect(mockOrderRepo.getUserAvailableCash).toHaveBeenCalledWith(
        1,
        66, // ARS_INSTRUMENT_ID
        mockClient // P0-1: Now uses transaction, passes client not null
      );
      expect(mockOrderRepo.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          instrumentId: 34,
          size: 5,
          price: "150.00", // P0-5: price is now string
          status: ORDER_STATUSES.FILLED,
        }),
        mockClient // P0-1: Now uses transaction, passes client not null
      );
    });

    it('should execute MARKET SELL order successfully when shares are sufficient', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockInstrumentRepo.findInstrumentById.mockResolvedValue({
        id: 34,
        ticker: 'AAPL',
        name: 'Apple Inc.',
        type: 'ACCIONES',
      });
      mockMarketDataRepo.getLatestMarketDataForInstrument.mockResolvedValue({
        instrumentId: 34,
        close: '150.00',
        previousClose: '148.00',
        date: new Date(),
      });
      mockOrderRepo.getUserPositionForInstrument.mockResolvedValue(10); // User has 10 shares
      mockOrderRepo.createOrder.mockResolvedValue({
        id: 2,
        userId: 1,
        instrumentId: 34,
        size: 5,
        price: '150.00',
        type: ORDER_TYPES.MARKET,
        side: ORDER_SIDES.SELL,
        status: ORDER_STATUSES.FILLED,
        datetime: new Date(),
      });

      const orderInput = {
        userId: 1,
        instrumentId: 34,
        side: ORDER_SIDES.SELL as any,
        type: ORDER_TYPES.MARKET as any,
        size: 5,
      };

      const response = await orderService.executeOrder(orderInput);

      expect(response.success).toBe(true);
      expect(response.order.status).toBe(ORDER_STATUSES.FILLED);
      expect(response.order.side).toBe(ORDER_SIDES.SELL);
      expect(mockOrderRepo.getUserPositionForInstrument).toHaveBeenCalledWith(
        1,
        34,
        mockClient // P0-1: Now uses transaction
      );
    });

    it('should create LIMIT order with NEW status', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockInstrumentRepo.findInstrumentById.mockResolvedValue({
        id: 34,
        ticker: 'AAPL',
        name: 'Apple Inc.',
        type: 'ACCIONES',
      });
      mockMarketDataRepo.getLatestMarketDataForInstrument.mockResolvedValue({
        instrumentId: 34,
        close: '150.00',
        previousClose: '148.00',
        date: new Date(),
      });
      mockOrderRepo.getUserAvailableCash.mockResolvedValue('10000.00');
      mockOrderRepo.createOrder.mockResolvedValue({
        id: 3,
        userId: 1,
        instrumentId: 34,
        size: 5,
        price: '140.00',
        type: ORDER_TYPES.LIMIT,
        side: ORDER_SIDES.BUY,
        status: ORDER_STATUSES.NEW,
        datetime: new Date(),
      });

      const orderInput = {
        userId: 1,
        instrumentId: 34,
        side: ORDER_SIDES.BUY as any,
        type: ORDER_TYPES.LIMIT as any,
        size: 5,
        price: 140,
      };

      const response = await orderService.executeOrder(orderInput);

      expect(response.success).toBe(true);
      expect(response.order.status).toBe(ORDER_STATUSES.NEW);
      expect(response.order.type).toBe(ORDER_TYPES.LIMIT);
      expect(response.order.price).toBe('140.00');
    });

    it('should REJECT order when insufficient funds for BUY', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockInstrumentRepo.findInstrumentById.mockResolvedValue({
        id: 34,
        ticker: 'AAPL',
        name: 'Apple Inc.',
        type: 'ACCIONES',
      });
      mockMarketDataRepo.getLatestMarketDataForInstrument.mockResolvedValue({
        instrumentId: 34,
        close: '150.00',
        previousClose: '148.00',
        date: new Date(),
      });
      mockOrderRepo.getUserAvailableCash.mockResolvedValue('500.00'); // Only $500 available
      mockOrderRepo.createOrder.mockResolvedValue({
        id: 4,
        userId: 1,
        instrumentId: 34,
        size: 10,
        price: '150.00',
        type: ORDER_TYPES.MARKET,
        side: ORDER_SIDES.BUY,
        status: ORDER_STATUSES.REJECTED,
        datetime: new Date(),
      });

      const orderInput = {
        userId: 1,
        instrumentId: 34,
        side: ORDER_SIDES.BUY as any,
        type: ORDER_TYPES.MARKET as any,
        size: 10, // Costs 1500, but only 500 available
      };

      const response = await orderService.executeOrder(orderInput);

      expect(response.success).toBe(true);
      expect(response.order.status).toBe(ORDER_STATUSES.REJECTED);
    });

    it('should REJECT order when insufficient shares for SELL', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockInstrumentRepo.findInstrumentById.mockResolvedValue({
        id: 34,
        ticker: 'AAPL',
        name: 'Apple Inc.',
        type: 'ACCIONES',
      });
      mockMarketDataRepo.getLatestMarketDataForInstrument.mockResolvedValue({
        instrumentId: 34,
        close: '150.00',
        previousClose: '148.00',
        date: new Date(),
      });
      mockOrderRepo.getUserPositionForInstrument.mockResolvedValue(5); // Only 5 shares
      mockOrderRepo.createOrder.mockResolvedValue({
        id: 5,
        userId: 1,
        instrumentId: 34,
        size: 10,
        price: '150.00',
        type: ORDER_TYPES.MARKET,
        side: ORDER_SIDES.SELL,
        status: ORDER_STATUSES.REJECTED,
        datetime: new Date(),
      });

      const orderInput = {
        userId: 1,
        instrumentId: 34,
        side: ORDER_SIDES.SELL as any,
        type: ORDER_TYPES.MARKET as any,
        size: 10, // Trying to sell 10, but only have 5
      };

      const response = await orderService.executeOrder(orderInput);

      expect(response.success).toBe(true);
      expect(response.order.status).toBe(ORDER_STATUSES.REJECTED);
    });

    it('should calculate size from amount for MARKET BUY', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockInstrumentRepo.findInstrumentById.mockResolvedValue({
        id: 34,
        ticker: 'AAPL',
        name: 'Apple Inc.',
        type: 'ACCIONES',
      });
      mockMarketDataRepo.getLatestMarketDataForInstrument.mockResolvedValue({
        instrumentId: 34,
        close: '150.00',
        previousClose: '148.00',
        date: new Date(),
      });
      mockOrderRepo.getUserAvailableCash.mockResolvedValue('10000.00');
      mockOrderRepo.createOrder.mockResolvedValue({
        id: 6,
        userId: 1,
        instrumentId: 34,
        size: 6, // 1000 / 150 = 6.66, floored to 6
        price: '150.00',
        type: ORDER_TYPES.MARKET,
        side: ORDER_SIDES.BUY,
        status: ORDER_STATUSES.FILLED,
        datetime: new Date(),
      });

      const orderInput = {
        userId: 1,
        instrumentId: 34,
        side: ORDER_SIDES.BUY as any,
        type: ORDER_TYPES.MARKET as any,
        amount: 1000, // Specify amount instead of size
      };

      const response = await orderService.executeOrder(orderInput);

      expect(response.success).toBe(true);
      expect(response.order.size).toBe(6); // Calculated from amount / price
      expect(mockOrderRepo.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 6,
        }),
        mockClient // P0-1: Now uses transaction
      );
    });

    it('should REJECT order when amount is too small to buy even 1 share', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockInstrumentRepo.findInstrumentById.mockResolvedValue({
        id: 34,
        ticker: 'AAPL',
        name: 'Apple Inc.',
        type: 'ACCIONES',
      });
      mockMarketDataRepo.getLatestMarketDataForInstrument.mockResolvedValue({
        instrumentId: 34,
        close: '150.00',
        previousClose: '148.00',
        date: new Date(),
      });
      mockOrderRepo.createOrder.mockResolvedValue({
        id: 7,
        userId: 1,
        instrumentId: 34,
        size: 0,
        price: '150.00',
        type: ORDER_TYPES.MARKET,
        side: ORDER_SIDES.BUY,
        status: ORDER_STATUSES.REJECTED,
        datetime: new Date(),
      });

      const orderInput = {
        userId: 1,
        instrumentId: 34,
        side: ORDER_SIDES.BUY as any,
        type: ORDER_TYPES.MARKET as any,
        amount: 50, // Only $50, but price is $150
      };

      const response = await orderService.executeOrder(orderInput);

      expect(response.success).toBe(true);
      expect(response.order.status).toBe(ORDER_STATUSES.REJECTED);
      expect(response.order.size).toBe(0);
    });
  });

  describe('getOrderById', () => {
    it('should retrieve an order by ID with totalAmount calculated', async () => {
      mockOrderRepo.findOrderById.mockResolvedValue({
        id: 1,
        userId: 1,
        instrumentId: 34,
        size: 5,
        price: '150.00',
        type: ORDER_TYPES.MARKET,
        side: ORDER_SIDES.BUY,
        status: ORDER_STATUSES.FILLED,
        datetime: new Date(),
        ticker: 'AAPL',
        name: 'Apple Inc.',
      });

      const order = await orderService.getOrderById(1);

      expect(order.id).toBe(1);
      expect(order.ticker).toBe('AAPL');
      expect(order.name).toBe('Apple Inc.');
      expect(order.totalAmount).toBe(750); // 5 * 150
    });

    it('should throw NotFoundError when order does not exist', async () => {
      mockOrderRepo.findOrderById.mockResolvedValue(null);

      await expect(orderService.getOrderById(999)).rejects.toThrow(NotFoundError);
      await expect(orderService.getOrderById(999)).rejects.toThrow(
        'Order with ID 999 not found'
      );
    });
  });

  describe('getUserOrders', () => {
    it('should throw NotFoundError when user does not exist', async () => {
      mockUserRepo.findUserById.mockResolvedValue(null);

      await expect(orderService.getUserOrders(999)).rejects.toThrow(NotFoundError);
      await expect(orderService.getUserOrders(999)).rejects.toThrow(
        'User with ID 999 not found'
      );
    });

    it('should return paginated orders for a user with totalAmount calculated', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockOrderRepo.getOrdersByUserId.mockResolvedValue({
        orders: [
          {
            id: 1,
            userId: 1,
            instrumentId: 34,
            size: 5,
            price: '150.00',
            type: ORDER_TYPES.MARKET,
            side: ORDER_SIDES.BUY,
            status: ORDER_STATUSES.FILLED,
            datetime: new Date('2024-01-15T10:30:00Z'),
          },
          {
            id: 2,
            userId: 1,
            instrumentId: 35,
            size: 10,
            price: '200.00',
            type: ORDER_TYPES.MARKET,
            side: ORDER_SIDES.SELL,
            status: ORDER_STATUSES.FILLED,
            datetime: new Date('2024-01-15T09:30:00Z'),
          },
        ],
        nextCursor: '2024-01-15T09:30:00.000Z',
        hasMore: true,
      });

      const response = await orderService.getUserOrders(1);

      expect(response.success).toBe(true);
      expect(response.orders).toHaveLength(2);
      expect(response.orders[0]!.totalAmount).toBe(750); // 5 * 150
      expect(response.orders[1]!.totalAmount).toBe(2000); // 10 * 200
      expect(response.nextCursor).toBe('2024-01-15T09:30:00.000Z');
      expect(response.hasMore).toBe(true);
    });

    it('should handle pagination with custom limit', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockOrderRepo.getOrdersByUserId.mockResolvedValue({
        orders: [
          {
            id: 1,
            userId: 1,
            instrumentId: 34,
            size: 5,
            price: '150.00',
            type: ORDER_TYPES.MARKET,
            side: ORDER_SIDES.BUY,
            status: ORDER_STATUSES.FILLED,
            datetime: new Date(),
          },
        ],
        nextCursor: null,
        hasMore: false,
      });

      const response = await orderService.getUserOrders(1, 10);

      expect(response.success).toBe(true);
      expect(response.orders).toHaveLength(1);
      expect(response.nextCursor).toBeNull();
      expect(response.hasMore).toBe(false);
      expect(mockOrderRepo.getOrdersByUserId).toHaveBeenCalledWith(1, 10, undefined);
    });

    it('should handle pagination with cursor', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockOrderRepo.getOrdersByUserId.mockResolvedValue({
        orders: [],
        nextCursor: null,
        hasMore: false,
      });

      const cursor = '2024-01-15T10:00:00.000Z';
      await orderService.getUserOrders(1, 20, cursor);

      expect(mockOrderRepo.getOrdersByUserId).toHaveBeenCalledWith(1, 20, cursor);
    });

    it('should return empty array when user has no orders', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockOrderRepo.getOrdersByUserId.mockResolvedValue({
        orders: [],
        nextCursor: null,
        hasMore: false,
      });

      const response = await orderService.getUserOrders(1);

      expect(response.success).toBe(true);
      expect(response.orders).toHaveLength(0);
      expect(response.nextCursor).toBeNull();
      expect(response.hasMore).toBe(false);
    });
  });

  describe('cancelOrder', () => {
    // P0-1: cancelOrder now uses transactions with direct client.query() calls
    // Tests need to mock client.query() responses instead of repository methods

    beforeEach(() => {
      // Reset mock before each test
      (mockClient.query as jest.Mock).mockReset();
    });

    it('should cancel a NEW order successfully', async () => {
      const mockOrder = {
        id: 1,
        userId: 1,
        instrumentId: 34,
        size: 5,
        price: '140.00',
        type: ORDER_TYPES.LIMIT,
        side: ORDER_SIDES.BUY,
        status: ORDER_STATUSES.NEW,
        datetime: new Date(),
      };

      // Mock the SELECT FOR UPDATE query (fetch order)
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockOrder],
      });

      // Mock the UPDATE query (cancel order)
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          ...mockOrder,
          status: ORDER_STATUSES.CANCELLED,
        }],
      });

      // Mock the SELECT query (get instrument)
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ticker: 'AAPL', name: 'Apple Inc.' }],
      });

      const response = await orderService.cancelOrder(1, 1);

      expect(response.success).toBe(true);
      expect(response.message).toBe('Order cancelled successfully');
      expect(response.order.status).toBe(ORDER_STATUSES.CANCELLED);
    });

    it('should throw NotFoundError when order does not exist', async () => {
      // Mock empty result for SELECT FOR UPDATE
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      await expect(orderService.cancelOrder(999, 1)).rejects.toThrow(
        'Order with ID 999 not found'
      );
    });

    it('should throw BusinessRuleError when user does not own the order', async () => {
      const mockOrder = {
        id: 1,
        userId: 2, // Different user
        instrumentId: 34,
        size: 5,
        price: '140.00',
        type: ORDER_TYPES.LIMIT,
        side: ORDER_SIDES.BUY,
        status: ORDER_STATUSES.NEW,
        datetime: new Date(),
      };

      // Mock the SELECT FOR UPDATE query
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockOrder],
      });

      await expect(orderService.cancelOrder(1, 1)).rejects.toThrow(
        'Order not found or not owned by user'
      );
    });

    it('should throw BusinessRuleError when trying to cancel FILLED order', async () => {
      const mockOrder = {
        id: 1,
        userId: 1,
        instrumentId: 34,
        size: 5,
        price: '150.00',
        type: ORDER_TYPES.MARKET,
        side: ORDER_SIDES.BUY,
        status: ORDER_STATUSES.FILLED,
        datetime: new Date(),
      };

      // Mock the SELECT FOR UPDATE query
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockOrder],
      });

      await expect(orderService.cancelOrder(1, 1)).rejects.toThrow(
        'Only NEW orders can be cancelled. Current status: FILLED'
      );
    });

    it('should throw BusinessRuleError when trying to cancel REJECTED order', async () => {
      const mockOrder = {
        id: 1,
        userId: 1,
        instrumentId: 34,
        size: 5,
        price: '150.00',
        type: ORDER_TYPES.MARKET,
        side: ORDER_SIDES.BUY,
        status: ORDER_STATUSES.REJECTED,
        datetime: new Date(),
      };

      // Mock the SELECT FOR UPDATE query
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockOrder],
      });

      await expect(orderService.cancelOrder(1, 1)).rejects.toThrow(
        'Only NEW orders can be cancelled. Current status: REJECTED'
      );
    });

    it('should throw BusinessRuleError when trying to cancel already CANCELLED order', async () => {
      const mockOrder = {
        id: 1,
        userId: 1,
        instrumentId: 34,
        size: 5,
        price: '140.00',
        type: ORDER_TYPES.LIMIT,
        side: ORDER_SIDES.BUY,
        status: ORDER_STATUSES.CANCELLED,
        datetime: new Date(),
      };

      // Mock the SELECT FOR UPDATE query
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockOrder],
      });

      await expect(orderService.cancelOrder(1, 1)).rejects.toThrow(
        'Only NEW orders can be cancelled. Current status: CANCELLED'
      );
    });
  });
});
