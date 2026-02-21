/**
 * Console Logger Adapter
 *
 * Simple logger implementation using pino for structured logging to stdout.
 * Used for development and when CloudWatch is not configured.
 *
 * Features:
 * - Structured JSON logging (parseable by log aggregators)
 * - Pretty printing in development (human-readable)
 * - Compatible with Docker/Kubernetes log collectors
 */

import pino from 'pino';
import { ILogger, LogMetadata } from '@/interfaces/ILogger';

export class ConsoleLogger implements ILogger {
  private logger: pino.Logger;

  constructor(context?: string) {
    this.logger = pino({
      name: context || 'app',
      level: process.env.LOG_LEVEL || 'info',
      // Pretty print in development for readability
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    });
  }

  debug(messageOrMetadata: string | LogMetadata, message?: string): void {
    if (typeof messageOrMetadata === 'string') {
      this.logger.debug(messageOrMetadata);
    } else {
      this.logger.debug(messageOrMetadata, message);
    }
  }

  info(messageOrMetadata: string | LogMetadata, message?: string): void {
    if (typeof messageOrMetadata === 'string') {
      this.logger.info(messageOrMetadata);
    } else {
      this.logger.info(messageOrMetadata, message);
    }
  }

  warn(messageOrMetadata: string | LogMetadata, message?: string): void {
    if (typeof messageOrMetadata === 'string') {
      this.logger.warn(messageOrMetadata);
    } else {
      this.logger.warn(messageOrMetadata, message);
    }
  }

  error(messageOrMetadata: string | LogMetadata, message?: string): void {
    if (typeof messageOrMetadata === 'string') {
      this.logger.error(messageOrMetadata);
    } else {
      this.logger.error(messageOrMetadata, message);
    }
  }

  fatal(messageOrMetadata: string | LogMetadata, message?: string): void {
    if (typeof messageOrMetadata === 'string') {
      this.logger.fatal(messageOrMetadata);
    } else {
      this.logger.fatal(messageOrMetadata, message);
    }
  }
}
