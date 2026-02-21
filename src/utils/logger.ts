import pino from 'pino';
import { env } from '@/config/env';

/**
 * Pino logger instance with configuration based on environment
 * In development: Pretty-printed for human readability
 * In production: JSON format for log aggregation systems
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development' && env.LOG_PRETTY
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with additional context
 */
export const createLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};
