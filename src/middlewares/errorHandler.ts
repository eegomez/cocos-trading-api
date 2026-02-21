import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '@/errors';
import { logger } from '@/adapters/logging/LoggerFactory';
import { env } from '@/config/env';

/**
 * Sanitize request body for logging
 * Creates a copy with sensitive fields redacted
 *
 * Privacy considerations:
 * - userId, instrumentId: NOT sensitive (needed for debugging, just IDs)
 * - price, amount, size: SENSITIVE (reveals trading activity/positions)
 *
 * Why redact trading data:
 * - Prevents internal developers from seeing user trading patterns
 * - Protects against insider trading (knowing what users are buying/selling)
 * - Compliance: User financial activity should be private
 *
 * Fields kept for debugging:
 * - userId, instrumentId: Needed to trace issues without revealing trading intent
 * - side, type: Order characteristics (not sensitive amounts)
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  // Sensitive: Trading amounts reveal user positions and intent
  const sensitiveFields = ['price', 'amount', 'size'];
  const sanitized: any = Array.isArray(body) ? [] : {};

  for (const key in body) {
    if (sensitiveFields.includes(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof body[key] === 'object' && body[key] !== null) {
      sanitized[key] = sanitizeRequestBody(body[key]);
    } else {
      sanitized[key] = body[key];
    }
  }

  return sanitized;
}

/**
 * Sanitize error messages for production
 *
 * Security Issue: Error messages can leak sensitive information:
 * - Database schema details (table/column names)
 * - Internal implementation details
 * - File paths and stack traces
 * - Business logic details
 *
 * Solution:
 * - In development: Show full error messages for debugging
 * - In production: Sanitize messages to prevent information disclosure
 */
function sanitizeErrorMessage(message: string): string {
  // In development, return full message for debugging
  if (env.NODE_ENV !== 'production') {
    return message;
  }

  // In production, check for sensitive patterns and sanitize
  const sensitivePatterns = [
    /database|postgres|sql|query/i, // Database errors
    /file|path|directory/i, // File system errors
    /internal|implementation/i, // Internal details
    /column|table|constraint/i, // Schema details
  ];

  const hasSensitiveInfo = sensitivePatterns.some(pattern => pattern.test(message));

  if (hasSensitiveInfo) {
    // Return generic message for sensitive errors
    return 'An error occurred while processing your request';
  }

  // Safe to return: user-facing messages like "Insufficient funds", "Order not found"
  return message;
}

/**
 * Global error handler middleware
 * Handles all errors thrown in the application
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error
  logger.error(
    {
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      request: {
        method: req.method,
        url: req.url,
        body: sanitizeRequestBody(req.body),
      },
    },
    'Error occurred'
  );

  // Handle known application errors
  if (err instanceof AppError) {
    const errorResponse: any = {
      success: false,
      error: {
        message: sanitizeErrorMessage(err.message),
      },
    };

    // Add validation details if available
    if (err instanceof ValidationError && err.errors) {
      errorResponse.error.details = err.errors;
    }

    res.status(err.statusCode).json(errorResponse);
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
    },
  });
}
