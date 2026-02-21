/**
 * Metrics Interface
 *
 * Abstraction for application performance monitoring (APM) and business metrics.
 * Enables switching between monitoring platforms (CloudWatch, DataDog, New Relic, etc.)
 * without changing application code.
 *
 * Design Pattern: Adapter Pattern
 * - Application code depends on this interface (not concrete implementations)
 * - Different adapters implement this interface for different platforms
 * - Factory selects the appropriate adapter based on environment
 */

/**
 * Metric metadata - dimensions/tags for metric filtering and grouping
 */
export type MetricDimensions = Record<string, string | number | boolean>;

/**
 * Metrics interface for tracking application and business events
 */
export interface IMetrics {
  /**
   * Increment a counter metric
   *
   * Use for: Counting events (orders placed, errors occurred, API calls)
   *
   * @param name - Metric name (e.g., "orders.created", "api.requests")
   * @param value - Amount to increment by (default: 1)
   * @param dimensions - Optional metadata for filtering (e.g., {status: "filled", side: "buy"})
   *
   * @example
   * metrics.incrementCounter("orders.created", 1, {side: "BUY", status: "FILLED"});
   */
  incrementCounter(name: string, value?: number, dimensions?: MetricDimensions): void;

  /**
   * Record a gauge metric (point-in-time value)
   *
   * Use for: Current state values (queue depth, active connections, available cash)
   *
   * @param name - Metric name (e.g., "db.connections.active", "portfolio.value")
   * @param value - Current value
   * @param dimensions - Optional metadata for filtering
   *
   * @example
   * metrics.recordGauge("db.connections.active", 15);
   * metrics.recordGauge("portfolio.total_value", 1500000, {userId: "123"});
   */
  recordGauge(name: string, value: number, dimensions?: MetricDimensions): void;

  /**
   * Record a histogram/timing metric
   *
   * Use for: Duration measurements (request latency, query time, processing time)
   *
   * @param name - Metric name (e.g., "api.response_time", "db.query.duration")
   * @param value - Duration in milliseconds
   * @param dimensions - Optional metadata for filtering
   *
   * @example
   * const start = Date.now();
   * await executeOrder(data);
   * metrics.recordHistogram("order.execution_time", Date.now() - start, {type: "MARKET"});
   */
  recordHistogram(name: string, value: number, dimensions?: MetricDimensions): void;

  /**
   * Record a distribution metric (for percentile calculations)
   *
   * Use for: Values needing percentile analysis (order amounts, position sizes)
   *
   * @param name - Metric name (e.g., "order.amount", "position.size")
   * @param value - Value to record
   * @param dimensions - Optional metadata for filtering
   *
   * @example
   * metrics.recordDistribution("order.amount_ars", orderAmount, {side: "BUY"});
   */
  recordDistribution(name: string, value: number, dimensions?: MetricDimensions): void;

  /**
   * Start a timer for automatic duration tracking
   *
   * Use for: Convenient timing of code blocks
   *
   * @param name - Metric name
   * @param dimensions - Optional metadata
   * @returns Function to call when operation completes
   *
   * @example
   * const endTimer = metrics.startTimer("order.processing");
   * await processOrder(data);
   * endTimer(); // Automatically records duration
   */
  startTimer(name: string, dimensions?: MetricDimensions): () => void;

  /**
   * Flush metrics to backend
   *
   * Use for: Ensuring metrics are sent before shutdown
   * Most implementations buffer metrics and send in batches
   */
  flush(): Promise<void>;
}

/**
 * Metrics Factory Interface
 *
 * Creates metrics instances based on environment configuration.
 * Implementations decide which metrics backend to use (CloudWatch, NoOp, etc.)
 */
export interface IMetricsFactory {
  /**
   * Create a metrics instance
   * @param namespace - Optional namespace for metrics (e.g., "TradingAPI", "OrderService")
   */
  createMetrics(namespace?: string): IMetrics;
}

/**
 * No-op Metrics Implementation
 *
 * Used for development/testing when metrics aren't needed.
 * All methods are no-ops (do nothing).
 */
export class NoOpMetrics implements IMetrics {
  incrementCounter(): void {}
  recordGauge(): void {}
  recordHistogram(): void {}
  recordDistribution(): void {}
  startTimer(): () => void {
    return () => {};
  }
  async flush(): Promise<void> {}
}
