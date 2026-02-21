import request from 'supertest';
import app from '@/app';

describe('Instruments API', () => {
  describe('GET /api/v1/instruments/search', () => {
    it('should search instruments by ticker', async () => {
      const response = await request(app)
        .get('/api/v1/instruments/search')
        .query({ q: 'GGAL' })
        .expect(200);

      expect(response.body.query).toBe('GGAL');
      expect(response.body.count).toBeGreaterThan(0);
      expect(Array.isArray(response.body.results)).toBe(true);

      const ggal = response.body.results.find((i: any) => i.ticker === 'GGAL');
      expect(ggal).toBeDefined();
      expect(ggal.name).toContain('Galicia');
    });

    it('should search instruments by name', async () => {
      const response = await request(app)
        .get('/api/v1/instruments/search')
        .query({ q: 'Banco' })
        .expect(200);

      expect(response.body.results.length).toBeGreaterThan(0);
      response.body.results.forEach((instrument: any) => {
        expect(instrument.name.toUpperCase()).toContain('BANCO');
      });
    });

    it('should return instruments with required fields', async () => {
      const response = await request(app)
        .get('/api/v1/instruments/search')
        .query({ q: 'PAMP' })
        .expect(200);

      expect(response.body.results.length).toBeGreaterThan(0);

      const instrument = response.body.results[0];
      expect(instrument).toHaveProperty('id');
      expect(instrument).toHaveProperty('ticker');
      expect(instrument).toHaveProperty('name');
      expect(instrument).toHaveProperty('type');
      expect(instrument.type).toBe('ACCIONES');
    });

    it('should be case-insensitive', async () => {
      const upperResponse = await request(app)
        .get('/api/v1/instruments/search')
        .query({ q: 'GGAL' })
        .expect(200);

      const lowerResponse = await request(app)
        .get('/api/v1/instruments/search')
        .query({ q: 'ggal' })
        .expect(200);

      expect(upperResponse.body.count).toBe(lowerResponse.body.count);
    });

    it('should return empty results for no matches', async () => {
      const response = await request(app)
        .get('/api/v1/instruments/search')
        .query({ q: 'XXXNONEXISTENT' })
        .expect(200);

      expect(response.body.count).toBe(0);
      expect(response.body.results).toHaveLength(0);
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/instruments/search')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for empty query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/instruments/search')
        .query({ q: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle partial matches', async () => {
      const response = await request(app)
        .get('/api/v1/instruments/search')
        .query({ q: 'PAM' })
        .expect(200);

      expect(response.body.results.length).toBeGreaterThan(0);
      const pamp = response.body.results.find((i: any) => i.ticker === 'PAMP');
      expect(pamp).toBeDefined();
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('cocos-trading-api');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body.name).toBe('Cocos Trading API');
      expect(response.body.endpoints).toBeDefined();
    });
  });

  describe('GET /api/nonexistent', () => {
    it('should return 404 for undefined routes', async () => {
      const response = await request(app).get('/api/nonexistent').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not found');
    });
  });
});
