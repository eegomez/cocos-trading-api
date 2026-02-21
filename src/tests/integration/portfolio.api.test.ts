import request from 'supertest';
import app from '@/app';

describe('Portfolio API', () => {
  describe('GET /api/v1/users/:userId/portfolio', () => {
    it('should return portfolio for valid user', async () => {
      const response = await request(app).get('/api/v1/users/1/portfolio').expect(200);

      expect(response.body.userId).toBe(1);
      expect(response.body.totalBalance).toBeGreaterThanOrEqual(0);
      expect(response.body.availableCash).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(response.body.positions)).toBe(true);
    });

    it('should return positions with all required fields', async () => {
      const response = await request(app).get('/api/v1/users/1/portfolio').expect(200);

      if (response.body.positions.length > 0) {
        const position = response.body.positions[0];

        expect(position).toHaveProperty('instrumentId');
        expect(position).toHaveProperty('ticker');
        expect(position).toHaveProperty('name');
        expect(position).toHaveProperty('quantity');
        expect(position).toHaveProperty('averageBuyPrice');
        expect(position).toHaveProperty('currentPrice');
        expect(position).toHaveProperty('marketValue');
        expect(position).toHaveProperty('totalReturn');
        expect(position).toHaveProperty('dailyReturn');
      }
    });

    it('should return empty positions for user with no trades', async () => {
      const response = await request(app).get('/api/v1/users/2/portfolio').expect(200);

      expect(response.body.userId).toBe(2);
      expect(response.body.positions).toHaveLength(0);
      expect(response.body.totalBalance).toBe(0);
      expect(response.body.availableCash).toBe(0);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app).get('/api/v1/users/99999/portfolio').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for invalid user ID', async () => {
      const response = await request(app)
        .get('/api/v1/users/invalid/portfolio')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should calculate total balance correctly', async () => {
      const response = await request(app).get('/api/v1/users/1/portfolio').expect(200);

      const positionsValue = response.body.positions.reduce(
        (sum: number, p: any) => sum + p.marketValue,
        0
      );

      const expectedTotal = response.body.availableCash + positionsValue;

      expect(response.body.totalBalance).toBeCloseTo(expectedTotal, 0);
    });

    it('should update after placing orders', async () => {
      // Get initial portfolio
      const initialResponse = await request(app)
        .get('/api/v1/users/1/portfolio')
        .expect(200);

      const initialCash = initialResponse.body.availableCash;

      // Place a small order
      await request(app)
        .post('/api/v1/orders')
        .send({
          userId: 1,
          instrumentId: 34,
          side: 'BUY',
          type: 'MARKET',
          size: 1,
        })
        .expect(201);

      // Get updated portfolio
      const updatedResponse = await request(app)
        .get('/api/v1/users/1/portfolio')
        .expect(200);

      // Cash should have decreased
      expect(updatedResponse.body.availableCash).toBeLessThan(initialCash);
    });
  });
});
