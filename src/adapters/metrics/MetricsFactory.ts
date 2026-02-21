/**
 * Metrics Factory
 *
 * Creates metrics instances based on environment configuration.
 * Selects the appropriate metrics implementation (NoOp vs CloudWatch).
 *
 * Selection Logic:
 * - METRICS_TYPE=cloudwatch → CloudWatchMetrics (for AWS deployments)
 * - METRICS_TYPE=noop or unset → NoOpMetrics (default, development)
 *
 * This allows easy switching between metrics backends via environment variables.
 */

import { IMetrics, IMetricsFactory } from '@/interfaces/IMetrics';
import { NoOpMetrics } from './NoOpMetrics';
import { CloudWatchMetrics } from './CloudWatchMetrics';

export class MetricsFactory implements IMetricsFactory {
  createMetrics(namespace?: string): IMetrics {
    const metricsType = process.env.METRICS_TYPE || 'noop';

    switch (metricsType.toLowerCase()) {
      case 'cloudwatch':
        return new CloudWatchMetrics(namespace);

      case 'noop':
      default:
        return new NoOpMetrics();
    }
  }
}

/**
 * Default metrics instance for application use
 */
const factory = new MetricsFactory();
export const metrics = factory.createMetrics('CocosTrading');

/**
 * Create named metrics for specific contexts
 */
export function createMetrics(namespace: string): IMetrics {
  return factory.createMetrics(namespace);
}
