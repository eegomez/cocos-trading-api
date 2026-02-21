import { Server } from 'http';
import app from './app';
import { env } from '@/config/env';
import { logger } from '@/adapters/logging/LoggerFactory';
import { testConnection, closePool } from '@/config/database';

/**
 * Server Entry Point
 * Starts the Express server and handles graceful shutdown
 */

let server: Server;

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start HTTP server
    server = app.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          env: env.NODE_ENV,
        },
        `🚀 Server running on http://localhost:${env.PORT}`
      );
      logger.info(`📊 API endpoints available at http://localhost:${env.PORT}/api`);
      logger.info(`❤️  Health check: http://localhost:${env.PORT}/api/health`);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${env.PORT} is already in use`);
      } else {
        logger.error({ error }, 'Server error');
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      // Close database connections
      try {
        await closePool();
        logger.info('Database connections closed');
      } catch (error) {
        logger.error({ error }, 'Error closing database connections');
      }

      logger.info('Graceful shutdown complete');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

/**
 * Process event handlers
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error(
    {
      reason,
      promise,
    },
    'Unhandled Promise Rejection'
  );
});

process.on('uncaughtException', (error) => {
  logger.error(
    {
      error,
    },
    'Uncaught Exception'
  );
  process.exit(1);
});

// Start the server
startServer();
