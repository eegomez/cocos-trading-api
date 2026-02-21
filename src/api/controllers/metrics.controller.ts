/**
 * Metrics Controller
 *
 * Exposes application metrics for monitoring and observability
 * Format: Prometheus text format (compatible with Grafana, DataDog, CloudWatch)
 *
 * Who uses these metrics:
 * - Prometheus: Scrapes /metrics endpoint every 15-60s
 * - Grafana: Visualizes metrics in dashboards
 * - DataDog: Agent can scrape Prometheus endpoints
 * - CloudWatch: Can pull custom metrics via AWS SDK
 * - PagerDuty: Alerts based on metric thresholds
 *
 * Example Prometheus scrape config:
 * ```yaml
 * scrape_configs:
 *   - job_name: 'cocos-trading-api'
 *     scrape_interval: 30s
 *     static_configs:
 *       - targets: ['api.cocos.com:3000']
 * ```
 */

import { Request, Response } from 'express';
import { getHttpMetrics } from '@/api/middlewares/metricsMiddleware';

/**
 * GET /metrics
 * Returns application metrics in Prometheus text format
 *
 * Metrics exposed:
 * - Process uptime
 * - Memory usage (heap, RSS)
 * - HTTP requests (total, latency)
 * - CPU usage
 *
 * Format: https://prometheus.io/docs/instrumenting/exposition_formats/
 */
export async function getMetrics(_req: Request, res: Response): Promise<void> {
  const metrics: string[] = [];

  // ============================================
  // HTTP Metrics (from middleware)
  // ============================================
  metrics.push(...getHttpMetrics());

  // ============================================
  // System Metrics
  // ============================================

  // Process uptime (seconds)
  metrics.push('# HELP process_uptime_seconds Process uptime in seconds');
  metrics.push('# TYPE process_uptime_seconds gauge');
  metrics.push(`process_uptime_seconds ${process.uptime()}`);
  metrics.push('');

  // Memory usage
  const memUsage = process.memoryUsage();

  metrics.push('# HELP process_heap_used_bytes Process heap memory used in bytes');
  metrics.push('# TYPE process_heap_used_bytes gauge');
  metrics.push(`process_heap_used_bytes ${memUsage.heapUsed}`);
  metrics.push('');

  metrics.push('# HELP process_heap_total_bytes Process heap memory total in bytes');
  metrics.push('# TYPE process_heap_total_bytes gauge');
  metrics.push(`process_heap_total_bytes ${memUsage.heapTotal}`);
  metrics.push('');

  metrics.push('# HELP process_rss_bytes Process resident set size in bytes');
  metrics.push('# TYPE process_rss_bytes gauge');
  metrics.push(`process_rss_bytes ${memUsage.rss}`);
  metrics.push('');

  // CPU usage
  const cpuUsage = process.cpuUsage();

  metrics.push('# HELP process_cpu_user_seconds_total Total user CPU time in seconds');
  metrics.push('# TYPE process_cpu_user_seconds_total counter');
  metrics.push(`process_cpu_user_seconds_total ${cpuUsage.user / 1000000}`); // Convert microseconds to seconds
  metrics.push('');

  metrics.push('# HELP process_cpu_system_seconds_total Total system CPU time in seconds');
  metrics.push('# TYPE process_cpu_system_seconds_total counter');
  metrics.push(`process_cpu_system_seconds_total ${cpuUsage.system / 1000000}`);
  metrics.push('');

  // ============================================
  // Application Info
  // ============================================

  metrics.push('# HELP app_info Application information');
  metrics.push('# TYPE app_info gauge');
  metrics.push(`app_info{version="1.0.0",node_version="${process.version}",env="${process.env.NODE_ENV || 'development'}"} 1`);
  metrics.push('');

  // ============================================
  // Future Metrics (TODO)
  // ============================================

  // TODO: Add database connection pool metrics
  // - db_pool_total: Total connections in pool
  // - db_pool_idle: Idle connections
  // - db_pool_waiting: Waiting requests
  // - db_query_duration_seconds: Query execution time histogram

  // TODO: Add business metrics
  // - orders_total{type,side,status}: Total orders created
  // - order_execution_duration_seconds: Order processing time

  // Return as plain text with proper content type
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metrics.join('\n'));
}
