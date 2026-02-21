/**
 * Logger Factory
 *
 * Creates logger instances based on environment configuration.
 * Selects the appropriate logger implementation (Console vs CloudWatch).
 *
 * Selection Logic:
 * - LOGGER_TYPE=cloudwatch → CloudWatchLogger (for AWS deployments)
 * - LOGGER_TYPE=console or unset → ConsoleLogger (default, development)
 *
 * This allows easy switching between logging backends via environment variables.
 */

import { ILogger, ILoggerFactory } from '@/interfaces/ILogger';
import { ConsoleLogger } from './ConsoleLogger';
import { CloudWatchLogger } from './CloudWatchLogger';

export class LoggerFactory implements ILoggerFactory {
  createLogger(context?: string): ILogger {
    const loggerType = process.env.LOGGER_TYPE || 'console';

    switch (loggerType.toLowerCase()) {
      case 'cloudwatch':
        return new CloudWatchLogger(context);

      case 'console':
      default:
        return new ConsoleLogger(context);
    }
  }
}

/**
 * Default logger instance for application use
 */
const factory = new LoggerFactory();
export const logger = factory.createLogger('app');

/**
 * Create named loggers for specific contexts
 */
export function createLogger(context: string): ILogger {
  return factory.createLogger(context);
}
