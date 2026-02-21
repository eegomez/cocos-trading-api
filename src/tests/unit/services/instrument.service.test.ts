import { InstrumentService } from '@/services/instrument.service';
import { createMockInstrumentRepository } from '@/tests/utils/mockRepositories';
import { IInstrumentRepository } from '@/repositories/interfaces';

describe('InstrumentService', () => {
  let instrumentService: InstrumentService;
  let mockInstrumentRepo: jest.Mocked<IInstrumentRepository>;

  beforeEach(() => {
    mockInstrumentRepo = createMockInstrumentRepository();
    instrumentService = new InstrumentService(mockInstrumentRepo);
  });

  describe('searchInstruments', () => {
    it('should search stocks by ticker and return formatted response', async () => {
      const mockResults = [
        {
          id: 1,
          ticker: 'GGAL',
          name: 'Grupo Financiero Galicia',
          type: 'ACCIONES' as const,
          lastPrice: '150.50',
          previousClose: '148.00',
          dailyChange: '1.69',
        },
      ];

      mockInstrumentRepo.searchStockInstruments.mockResolvedValue(mockResults);

      const response = await instrumentService.searchInstruments('GGAL');

      expect(response.query).toBe('GGAL');
      expect(response.count).toBe(1);
      expect(response.results).toEqual(mockResults);
      expect(mockInstrumentRepo.searchStockInstruments).toHaveBeenCalledWith('GGAL');
    });

    it('should trim whitespace before calling repository', async () => {
      mockInstrumentRepo.searchStockInstruments.mockResolvedValue([]);

      const response = await instrumentService.searchInstruments('  GGAL  ');

      expect(response.query).toBe('  GGAL  '); // Returns original query
      expect(mockInstrumentRepo.searchStockInstruments).toHaveBeenCalledWith('GGAL'); // Calls repo with trimmed
    });

    it('should return empty results for empty query', async () => {
      const response = await instrumentService.searchInstruments('');

      expect(response.query).toBe('');
      expect(response.count).toBe(0);
      expect(response.results).toEqual([]);
      expect(mockInstrumentRepo.searchStockInstruments).not.toHaveBeenCalled();
    });

    it('should return empty results for whitespace-only query', async () => {
      const response = await instrumentService.searchInstruments('   ');

      expect(response.query).toBe('   '); // Returns original query with whitespace
      expect(response.count).toBe(0);
      expect(response.results).toEqual([]);
      expect(mockInstrumentRepo.searchStockInstruments).not.toHaveBeenCalled();
    });

    it('should return multiple results from repository', async () => {
      const mockResults = [
        {
          id: 1,
          ticker: 'GGAL',
          name: 'Grupo Financiero Galicia',
          type: 'ACCIONES' as const,
          lastPrice: '150.50',
          previousClose: '148.00',
          dailyChange: '1.69',
        },
        {
          id: 2,
          ticker: 'YPF',
          name: 'YPF Sociedad Anónima',
          type: 'ACCIONES' as const,
          lastPrice: '1200.00',
          previousClose: '1180.00',
          dailyChange: '1.69',
        },
      ];

      mockInstrumentRepo.searchStockInstruments.mockResolvedValue(mockResults);

      const response = await instrumentService.searchInstruments('A');

      expect(response.count).toBe(2);
      expect(response.results).toHaveLength(2);
      expect(response.results).toEqual(mockResults);
    });

    it('should return empty array when no matches found', async () => {
      mockInstrumentRepo.searchStockInstruments.mockResolvedValue([]);

      const response = await instrumentService.searchInstruments('XXXNONEXISTENT');

      expect(response.query).toBe('XXXNONEXISTENT');
      expect(response.count).toBe(0);
      expect(response.results).toEqual([]);
      expect(mockInstrumentRepo.searchStockInstruments).toHaveBeenCalledWith('XXXNONEXISTENT');
    });

    it('should handle stocks with null price data', async () => {
      const mockResults = [
        {
          id: 1,
          ticker: 'TEST',
          name: 'Test Company',
          type: 'ACCIONES' as const,
          lastPrice: null,
          previousClose: null,
          dailyChange: null,
        },
      ];

      mockInstrumentRepo.searchStockInstruments.mockResolvedValue(mockResults);

      const response = await instrumentService.searchInstruments('TEST');

      expect(response.count).toBe(1);
      expect(response.results[0]!.lastPrice).toBeNull();
      expect(response.results[0]!.previousClose).toBeNull();
      expect(response.results[0]!.dailyChange).toBeNull();
    });
  });
});
