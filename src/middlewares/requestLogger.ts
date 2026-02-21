import pinoHttp from 'pino-http';
// requestLogger uses pino directly (pino-http requires a pino instance, not LoggerFactory)
import { logger } from '@/utils/logger';

/**
 * Request logger middleware
 * Logs all HTTP requests and responses with minimal information
 */
export const requestLogger = pinoHttp({
  logger,
  autoLogging: true,
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${err.message}`;
  },
  // Customize what gets logged for requests and responses
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      // Only include user-agent and important headers
      userAgent: req.headers['user-agent'],
      ip: req.raw.socket.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      responseTime: res.raw.responseTime,
    }),
    err: (err) => ({
      type: err.type,
      message: err.message,
      stack: err.stack,
    }),
  },
});
