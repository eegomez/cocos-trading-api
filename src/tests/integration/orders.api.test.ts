import request from 'supertest';
import app from '@/app';

describe('Orders API', () => {
  describe('POST /api/v1/orders', () => {
    it('should create a MARKET BUY order', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId: 1,
          instrumentId: 34,
          side: 'BUY',
          type: 'MARKET',
          size: 1,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.order).toBeDefined();
      expect(response.body.order.status).toBe('FILLED');
      expect(response.body.order.totalAmount).toBeGreaterThan(0);
    });

    it('should create a LIMIT order with NEW status', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId: 1,
          instrumentId: 34,
          side: 'BUY',
          type: 'LIMIT',
          size: 1,
          price: 900,
        })
        .expect(201);

      expect(response.body.order.status).toBe('NEW');
      // Price is returned as string from NUMERIC column
      expect(response.body.order.price).toBe('900.00');
    });

    it('should create order with amount instead of size', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId: 1,
          instrumentId: 34,
          side: 'BUY',
          type: 'MARKET',
          amount: 5000,
        })
        .expect(201);

      expect(response.body.order.size).toBeGreaterThan(0);
      expect(response.body.order.totalAmount).toBeLessThanOrEqual(5000);
    });

    it('should reject order with insufficient funds', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId: 1,
          instrumentId: 34,
          side: 'BUY',
          type: 'MARKET',
          size: 1000000,
        })
        .expect(201);

      expect(response.body.order.status).toBe('REJECTED');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId: 1,
          // Missing instrumentId
          side: 'BUY',
          type: 'MARKET',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for invalid order type', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId: 1,
          instrumentId: 34,
          side: 'BUY',
          type: 'INVALID_TYPE',
          size: 1,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when both size and amount provided', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId: 1,
          instrumentId: 34,
          side: 'BUY',
          type: 'MARKET',
          size: 1,
          amount: 1000,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for LIMIT order without price', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId: 1,
          instrumentId: 34,
          side: 'BUY',
          type: 'LIMIT',
          size: 1,
          // Missing price
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for invalid user', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId: 99999,
          instrumentId: 34,
          side: 'BUY',
          type: 'MARKET',
          size: 1,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/orders/:orderId', () => {
    it('should retrieve an order by ID', async () => {
      // First create an order
      const createResponse = await request(app)
        .post('/api/v1/orders')
        .send({
          userId: 1,
          instrumentId: 34,
          side: 'BUY',
          type: 'MARKET',
          size: 1,
        })
        .expect(201);

      const orderId = createResponse.body.order.id;

      // Then retrieve it
      const response = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .expect(200);

      expect(response.body.id).toBe(orderId);
      expect(response.body.ticker).toBeDefined();
      expect(response.body.name).toBeDefined();
      expect(response.body.totalAmount).toBeDefined();
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app).get('/api/v1/orders/99999').expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid order ID', async () => {
      const response = await request(app).get('/api/v1/orders/invalid').expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
