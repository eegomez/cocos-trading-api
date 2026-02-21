/**
 * Logger Interface
 *
 * Abstraction for logging across different environments and platforms.
 * Enables switching between logging implementations (Console, CloudWatch, GCP, etc.)
 * without changing application code.
 *
 * Design Pattern: Adapter Pattern
 * - Application code depends on this interface (not concrete implementations)
 * - Different adapters implement this interface for different platforms
 * - Factory selects the appropriate adapter based on environment
 */

/**
 * Log metadata - structured data attached to log entries
 */
export type LogMetadata = Record<string, any>;

/**
 * Logger interface following common logging patterns (pino, winston, etc.)
 */
export interface ILogger {
  /**
   * Debug level - Detailed diagnostic information
   * Use for: Development debugging, tracing execution flow
   * Example: "Portfolio calculation started", "Database query executed"
   */
  debug(message: string): void;
  debug(metadata: LogMetadata, message: string): void;

  /**
   * Info level - General informational messages
   * Use for: Normal operations, business events, audit trails
   * Example: "Order executed", "User logged in", "Payment processed"
   */
  info(message: string): void;
  info(metadata: LogMetadata, message: string): void;

  /**
   * Warn level - Warning conditions that should be reviewed
   * Use for: Degraded operations, recoverable errors, validation failures
   * Example: "Insufficient funds", "Rate limit approaching", "Deprecated API used"
   */
  warn(message: string): void;
  warn(metadata: LogMetadata, message: string): void;

  /**
   * Error level - Error conditions requiring attention
   * Use for: Failed operations, caught exceptions, system errors
   * Example: "Database connection failed", "Payment gateway error", "Invalid state"
   */
  error(message: string): void;
  error(metadata: LogMetadata, message: string): void;

  /**
   * Fatal level - Critical errors causing application shutdown
   * Use for: Unrecoverable errors, system-wide failures
   * Example: "Database unreachable", "Critical configuration missing"
   */
  fatal(message: string): void;
  fatal(metadata: LogMetadata, message: string): void;
}

/**
 * Logger Factory Interface
 *
 * Creates logger instances based on environment configuration.
 * Implementations decide which logger to use (Console, CloudWatch, etc.)
 */
export interface ILoggerFactory {
  /**
   * Create a logger instance
   * @param context - Optional context name for logger (e.g., "OrderService", "Database")
   */
  createLogger(context?: string): ILogger;
}
