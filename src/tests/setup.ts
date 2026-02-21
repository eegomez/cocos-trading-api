import { Pool } from 'pg';

/**
 * Test database setup
 * Creates a test database and handles cleanup
 */

let testPool: Pool;

export async function setupTestDatabase(): Promise<Pool> {
  testPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'cocos_trading',
    user: process.env.DB_USER || 'egomez',
    password: process.env.DB_PASSWORD || '',
    max: 5,
  });

  return testPool;
}

export async function cleanupTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
  }
}

// Global test setup
beforeAll(async () => {
  await setupTestDatabase();
});

// Global test cleanup
afterAll(async () => {
  await cleanupTestDatabase();
});
