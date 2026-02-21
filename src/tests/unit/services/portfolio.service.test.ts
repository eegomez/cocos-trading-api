import { PortfolioService } from '@/services/portfolio.service';
import {
  createMockUserRepository,
  createMockOrderRepository,
  createMockMarketDataRepository,
  createMockInstrumentRepository,
} from '@/tests/utils/mockRepositories';
import {
  IUserRepository,
  IOrderRepository,
  IMarketDataRepository,
  IInstrumentRepository,
} from '@/repositories/interfaces';
import { NotFoundError } from '@/errors';

describe('PortfolioService', () => {
  let portfolioService: PortfolioService;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockOrderRepo: jest.Mocked<IOrderRepository>;
  let mockMarketDataRepo: jest.Mocked<IMarketDataRepository>;
  let mockInstrumentRepo: jest.Mocked<IInstrumentRepository>;

  beforeEach(() => {
    mockUserRepo = createMockUserRepository();
    mockOrderRepo = createMockOrderRepository();
    mockMarketDataRepo = createMockMarketDataRepository();
    mockInstrumentRepo = createMockInstrumentRepository();

    portfolioService = new PortfolioService(
      mockUserRepo,
      mockOrderRepo,
      mockMarketDataRepo,
      mockInstrumentRepo
    );
  });

  describe('getUserPortfolio', () => {
    it('should throw NotFoundError when user does not exist', async () => {
      mockUserRepo.findUserById.mockResolvedValue(null);

      await expect(portfolioService.getUserPortfolio(999)).rejects.toThrow(
        NotFoundError
      );
      await expect(portfolioService.getUserPortfolio(999)).rejects.toThrow(
        'User with ID 999 not found'
      );
    });

    it('should return empty portfolio when user has no orders', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockOrderRepo.getFilledOrdersByUserId.mockResolvedValue([]);
      mockOrderRepo.getUserAvailableCash.mockResolvedValue('0');

      const portfolio = await portfolioService.getUserPortfolio(1);

      expect(portfolio.userId).toBe(1);
      expect(portfolio.totalBalance).toBe(0);
      expect(portfolio.availableCash).toBe(0);
      expect(portfolio.positions).toEqual([]);
    });

    it('should return portfolio with only cash when user has no stock orders', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      // User has only CASH_IN orders (ARS instrument = 1)
      mockOrderRepo.getFilledOrdersByUserId.mockResolvedValue([
        {
          id: 1,
          userId: 1,
          instrumentId: 1, // ARS_INSTRUMENT_ID
          size: 1,
          price: '50000.00',
          type: 'MARKET',
          side: 'CASH_IN',
          status: 'FILLED',
          datetime: new Date(),
        },
      ]);
      mockOrderRepo.getUserAvailableCash.mockResolvedValue('50000.00');

      const portfolio = await portfolioService.getUserPortfolio(1);

      expect(portfolio.userId).toBe(1);
      expect(portfolio.totalBalance).toBe(50000);
      expect(portfolio.availableCash).toBe(50000);
      expect(portfolio.positions).toEqual([]);
    });

    it('should calculate portfolio with BUY orders correctly', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockOrderRepo.getFilledOrdersByUserId.mockResolvedValue([
        {
          id: 1,
          userId: 1,
          instrumentId: 34,
          size: 10,
          price: '100.00',
          type: 'MARKET',
          side: 'BUY',
          status: 'FILLED',
          datetime: new Date(),
        },
      ]);
      mockOrderRepo.getUserAvailableCash.mockResolvedValue('49000.00');
      mockMarketDataRepo.getLatestMarketDataForInstruments.mockResolvedValue(
        new Map([
          [
            34,
            {
              instrumentId: 34,
              close: '120.00',
              previousClose: '100.00',
              date: new Date(),
            },
          ],
        ])
      );
      mockInstrumentRepo.findInstrumentsByIds.mockResolvedValue([
        { id: 34, ticker: 'AAPL', name: 'Apple Inc.', type: 'ACCIONES' },
      ]);

      const portfolio = await portfolioService.getUserPortfolio(1);

      expect(portfolio.userId).toBe(1);
      expect(portfolio.availableCash).toBe(49000);
      expect(portfolio.positions).toHaveLength(1);

      const position = portfolio.positions[0]!;
      expect(position.instrumentId).toBe(34);
      expect(position.ticker).toBe('AAPL');
      expect(position.name).toBe('Apple Inc.');
      expect(position.quantity).toBe(10);
      expect(position.averageBuyPrice).toBe(100);
      expect(position.currentPrice).toBe(120);
      expect(position.marketValue).toBe(1200);
      expect(position.totalReturn).toBe(20); // (120-100)/100 * 100
      expect(position.dailyReturn).toBe(20); // (120-100)/100 * 100

      expect(portfolio.totalBalance).toBe(50200); // 49000 cash + 1200 stocks
    });

    it('should calculate portfolio with BUY and SELL orders correctly', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockOrderRepo.getFilledOrdersByUserId.mockResolvedValue([
        {
          id: 1,
          userId: 1,
          instrumentId: 34,
          size: 10,
          price: '100.00',
          type: 'MARKET',
          side: 'BUY',
          status: 'FILLED',
          datetime: new Date('2024-01-01'),
        },
        {
          id: 2,
          userId: 1,
          instrumentId: 34,
          size: 4,
          price: '120.00',
          type: 'MARKET',
          side: 'SELL',
          status: 'FILLED',
          datetime: new Date('2024-01-02'),
        },
      ]);
      mockOrderRepo.getUserAvailableCash.mockResolvedValue('49480.00');
      mockMarketDataRepo.getLatestMarketDataForInstruments.mockResolvedValue(
        new Map([
          [
            34,
            {
              instrumentId: 34,
              close: '110.00',
              previousClose: '108.00',
              date: new Date(),
            },
          ],
        ])
      );
      mockInstrumentRepo.findInstrumentsByIds.mockResolvedValue([
        { id: 34, ticker: 'AAPL', name: 'Apple Inc.', type: 'ACCIONES' },
      ]);

      const portfolio = await portfolioService.getUserPortfolio(1);

      expect(portfolio.positions).toHaveLength(1);

      const position = portfolio.positions[0]!;
      expect(position.quantity).toBe(6); // 10 bought - 4 sold
      expect(position.averageBuyPrice).toBe(100); // Original cost basis preserved
      expect(position.currentPrice).toBe(110);
      expect(position.marketValue).toBe(660); // 6 * 110
      expect(position.totalReturn).toBe(10); // (110-100)/100 * 100
    });

    it('should exclude positions where quantity drops to zero', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockOrderRepo.getFilledOrdersByUserId.mockResolvedValue([
        {
          id: 1,
          userId: 1,
          instrumentId: 34,
          size: 10,
          price: '100.00',
          type: 'MARKET',
          side: 'BUY',
          status: 'FILLED',
          datetime: new Date('2024-01-01'),
        },
        {
          id: 2,
          userId: 1,
          instrumentId: 34,
          size: 10,
          price: '120.00',
          type: 'MARKET',
          side: 'SELL',
          status: 'FILLED',
          datetime: new Date('2024-01-02'),
        },
      ]);
      mockOrderRepo.getUserAvailableCash.mockResolvedValue('51200.00');

      const portfolio = await portfolioService.getUserPortfolio(1);

      expect(portfolio.positions).toHaveLength(0);
      expect(portfolio.availableCash).toBe(51200);
      expect(portfolio.totalBalance).toBe(51200);
    });

    it('should skip positions with missing market data', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockOrderRepo.getFilledOrdersByUserId.mockResolvedValue([
        {
          id: 1,
          userId: 1,
          instrumentId: 34,
          size: 10,
          price: '100.00',
          type: 'MARKET',
          side: 'BUY',
          status: 'FILLED',
          datetime: new Date(),
        },
      ]);
      mockOrderRepo.getUserAvailableCash.mockResolvedValue('49000.00');
      // No market data for instrument 34
      mockMarketDataRepo.getLatestMarketDataForInstruments.mockResolvedValue(
        new Map()
      );
      mockInstrumentRepo.findInstrumentsByIds.mockResolvedValue([
        { id: 34, ticker: 'AAPL', name: 'Apple Inc.', type: 'ACCIONES' },
      ]);

      const portfolio = await portfolioService.getUserPortfolio(1);

      expect(portfolio.positions).toHaveLength(0);
    });

    it('should skip positions with missing instrument data', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockOrderRepo.getFilledOrdersByUserId.mockResolvedValue([
        {
          id: 1,
          userId: 1,
          instrumentId: 34,
          size: 10,
          price: '100.00',
          type: 'MARKET',
          side: 'BUY',
          status: 'FILLED',
          datetime: new Date(),
        },
      ]);
      mockOrderRepo.getUserAvailableCash.mockResolvedValue('49000.00');
      mockMarketDataRepo.getLatestMarketDataForInstruments.mockResolvedValue(
        new Map([
          [
            34,
            {
              instrumentId: 34,
              close: '120.00',
              previousClose: '100.00',
              date: new Date(),
            },
          ],
        ])
      );
      // No instrument data for instrument 34
      mockInstrumentRepo.findInstrumentsByIds.mockResolvedValue([]);

      const portfolio = await portfolioService.getUserPortfolio(1);

      expect(portfolio.positions).toHaveLength(0);
    });

    it('should sort positions by market value descending', async () => {
      mockUserRepo.findUserById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        accountNumber: '123456',
      });
      mockOrderRepo.getFilledOrdersByUserId.mockResolvedValue([
        {
          id: 1,
          userId: 1,
          instrumentId: 34,
          size: 10,
          price: '100.00',
          type: 'MARKET',
          side: 'BUY',
          status: 'FILLED',
          datetime: new Date(),
        },
        {
          id: 2,
          userId: 1,
          instrumentId: 35,
          size: 5,
          price: '200.00',
          type: 'MARKET',
          side: 'BUY',
          status: 'FILLED',
          datetime: new Date(),
        },
      ]);
      mockOrderRepo.getUserAvailableCash.mockResolvedValue('48000.00');
      mockMarketDataRepo.getLatestMarketDataForInstruments.mockResolvedValue(
        new Map([
          [
            34,
            {
              instrumentId: 34,
              close: '120.00',
              previousClose: '100.00',
              date: new Date(),
            },
          ],
          [
            35,
            {
              instrumentId: 35,
              close: '300.00',
              previousClose: '280.00',
              date: new Date(),
            },
          ],
        ])
      );
      mockInstrumentRepo.findInstrumentsByIds.mockResolvedValue([
        { id: 34, ticker: 'AAPL', name: 'Apple Inc.', type: 'ACCIONES' },
        { id: 35, ticker: 'GOOGL', name: 'Alphabet Inc.', type: 'ACCIONES' },
      ]);

      const portfolio = await portfolioService.getUserPortfolio(1);

      expect(portfolio.positions).toHaveLength(2);
      // GOOGL should be first (5 * 300 = 1500) > AAPL (10 * 120 = 1200)
      expect(portfolio.positions[0]!.ticker).toBe('GOOGL');
      expect(portfolio.positions[0]!.marketValue).toBe(1500);
      expect(portfolio.positions[1]!.ticker).toBe('AAPL');
      expect(portfolio.positions[1]!.marketValue).toBe(1200);
    });
  });
});
