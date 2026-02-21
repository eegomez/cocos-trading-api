/**
 * No-Op Metrics Adapter
 *
 * Metrics implementation that does nothing (no-operation).
 * Used for development and testing when metrics collection isn't needed.
 *
 * Benefits:
 * - Zero performance overhead
 * - No external dependencies
 * - Safe fallback if metrics backend is unavailable
 */

import { IMetrics, MetricDimensions } from '@/interfaces/IMetrics';

export class NoOpMetrics implements IMetrics {
  incrementCounter(
    _name: string,
    _value?: number,
    _dimensions?: MetricDimensions
  ): void {
    // No-op: intentionally does nothing
  }

  recordGauge(_name: string, _value: number, _dimensions?: MetricDimensions): void {
    // No-op: intentionally does nothing
  }

  recordHistogram(_name: string, _value: number, _dimensions?: MetricDimensions): void {
    // No-op: intentionally does nothing
  }

  recordDistribution(
    _name: string,
    _value: number,
    _dimensions?: MetricDimensions
  ): void {
    // No-op: intentionally does nothing
  }

  startTimer(_name: string, _dimensions?: MetricDimensions): () => void {
    // Return a no-op function
    return () => {};
  }

  async flush(): Promise<void> {
    // No-op: intentionally does nothing
  }
}
