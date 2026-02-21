/**
 * HTTP Metrics Middleware
 *
 * Tracks HTTP request metrics for monitoring and alerting:
 * - Total requests by method, path, and status code
 * - Request duration/latency
 *
 * Metrics exposed:
 * - http_requests_total{method,path,status}
 * - http_request_duration_seconds{method,path}
 */

import { Request, Response, NextFunction } from 'express';

// In-memory storage for metrics
const requestCounts = new Map<string, number>();
const requestDurations = new Map<string, number[]>();

/**
 * Generate metric key for counting
 */
function getMetricKey(method: string, path: string, status: number): string {
  return `${method}:${path}:${status}`;
}

/**
 * Generate metric key for duration tracking
 */
function getDurationKey(method: string, path: string): string {
  return `${method}:${path}`;
}

/**
 * Normalize path to avoid cardinality explosion
 * Examples:
 * - /api/users/123/portfolio -> /api/users/:id/portfolio
 * - /api/orders/456 -> /api/orders/:id
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/\d+/g, '/:id') // Replace numeric IDs
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid'); // Replace UUIDs
}

/**
 * Middleware to track HTTP request metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const path = normalizePath(req.path || req.url);

  // Skip tracking for metrics and health endpoints to avoid noise
  if (path === '/api/metrics' || path === '/api/health') {
    next();
    return;
  }

  const startTime = Date.now();

  // Capture response finish event
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const method = req.method;
    const status = res.statusCode;

    // Track request count
    const countKey = getMetricKey(method, path, status);
    requestCounts.set(countKey, (requestCounts.get(countKey) || 0) + 1);

    // Track request duration
    const durationKey = getDurationKey(method, path);
    const durations = requestDurations.get(durationKey) || [];
    durations.push(duration);

    // Keep only last 1000 durations per endpoint to limit memory
    if (durations.length > 1000) {
      durations.shift();
    }

    requestDurations.set(durationKey, durations);
  });

  next();
}

/**
 * Get all HTTP request metrics in Prometheus format
 */
export function getHttpMetrics(): string[] {
  const metrics: string[] = [];

  // ============================================
  // HTTP Requests Total (Counter)
  // ============================================
  metrics.push('# HELP http_requests_total Total HTTP requests');
  metrics.push('# TYPE http_requests_total counter');

  for (const [key, count] of requestCounts.entries()) {
    const [method, path, status] = key.split(':');
    metrics.push(`http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`);
  }
  metrics.push('');

  // ============================================
  // HTTP Request Duration (Summary)
  // ============================================
  metrics.push('# HELP http_request_duration_seconds HTTP request duration in seconds');
  metrics.push('# TYPE http_request_duration_seconds summary');

  for (const [key, durations] of requestDurations.entries()) {
    const [method, path] = key.split(':');

    if (durations.length === 0) continue;

    // Calculate statistics
    const sum = durations.reduce((a, b) => a + b, 0);
    const count = durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(count * 0.50)] || 0;
    const p95 = sorted[Math.floor(count * 0.95)] || 0;
    const p99 = sorted[Math.floor(count * 0.99)] || 0;

    // Summary format: method_path{quantile="0.5"} value
    metrics.push(`http_request_duration_seconds{method="${method}",path="${path}",quantile="0.5"} ${p50.toFixed(4)}`);
    metrics.push(`http_request_duration_seconds{method="${method}",path="${path}",quantile="0.95"} ${p95.toFixed(4)}`);
    metrics.push(`http_request_duration_seconds{method="${method}",path="${path}",quantile="0.99"} ${p99.toFixed(4)}`);
    metrics.push(`http_request_duration_seconds_sum{method="${method}",path="${path}"} ${sum.toFixed(4)}`);
    metrics.push(`http_request_duration_seconds_count{method="${method}",path="${path}"} ${count}`);
  }
  metrics.push('');

  return metrics;
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  requestCounts.clear();
  requestDurations.clear();
}
