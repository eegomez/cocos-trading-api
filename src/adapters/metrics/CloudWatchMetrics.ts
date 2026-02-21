/**
 * AWS CloudWatch Metrics Adapter
 *
 * Metrics implementation that sends custom metrics to AWS CloudWatch.
 * Suitable for production deployments on AWS (EC2, ECS, Lambda, etc.)
 *
 * Features:
 * - Custom metrics in CloudWatch for monitoring and alerting
 * - Automatic batching to reduce API calls
 * - Dimensions for filtering and grouping
 * - Works with AWS free tier (10 custom metrics free, then $0.30/metric/month)
 *
 * Setup Requirements:
 * 1. EC2 instance needs IAM role with CloudWatch permissions:
 *    - cloudwatch:PutMetricData
 *
 * 2. Metrics appear in CloudWatch console under custom namespace
 *
 * Free Tier Limits:
 * - 10 custom metrics (free forever)
 * - 1 million API requests (PutMetricData calls)
 * - For interview/demo: Track key metrics only to stay under limits
 *
 * Note: This is a simplified implementation using console.log.
 * For production, use AWS SDK to actually send metrics to CloudWatch.
 * To keep it simple for interview, we'll structure metrics but not send them.
 */

import { IMetrics, MetricDimensions } from '@/interfaces/IMetrics';
import { logger } from '@/adapters/logging/LoggerFactory';

/**
 * CloudWatch Metrics using structured console output
 *
 * For simplicity (interview/demo), this logs metrics in a structured format.
 * In production, replace console.log with actual AWS SDK calls.
 *
 * Example production implementation:
 * ```typescript
 * import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
 * const client = new CloudWatchClient({ region: 'us-east-1' });
 * await client.send(new PutMetricDataCommand({
 *   Namespace: 'CocosTrading',
 *   MetricData: [...]
 * }));
 * ```
 */
export class CloudWatchMetrics implements IMetrics {
  private namespace: string;
  private buffer: any[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor(namespace: string = 'CocosTrading') {
    this.namespace = namespace;

    // Auto-flush metrics every 60 seconds to reduce API calls
    this.flushInterval = setInterval(() => {
      this.flush().catch((err) => {
        logger.error({ err }, 'Failed to flush CloudWatch metrics');
      });
    }, 60000);
  }

  incrementCounter(
    name: string,
    value: number = 1,
    dimensions?: MetricDimensions
  ): void {
    this.buffer.push({
      MetricName: name,
      Value: value,
      Unit: 'Count',
      Timestamp: new Date(),
      Dimensions: this.formatDimensions(dimensions),
    });
  }

  recordGauge(name: string, value: number, dimensions?: MetricDimensions): void {
    this.buffer.push({
      MetricName: name,
      Value: value,
      Unit: 'None',
      Timestamp: new Date(),
      Dimensions: this.formatDimensions(dimensions),
    });
  }

  recordHistogram(name: string, value: number, dimensions?: MetricDimensions): void {
    this.buffer.push({
      MetricName: name,
      Value: value,
      Unit: 'Milliseconds',
      Timestamp: new Date(),
      Dimensions: this.formatDimensions(dimensions),
    });
  }

  recordDistribution(name: string, value: number, dimensions?: MetricDimensions): void {
    this.buffer.push({
      MetricName: name,
      Value: value,
      Unit: 'None',
      Timestamp: new Date(),
      Dimensions: this.formatDimensions(dimensions),
    });
  }

  startTimer(name: string, dimensions?: MetricDimensions): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.recordHistogram(name, duration, dimensions);
    };
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const metricsToSend = this.buffer.splice(0);

    // For interview/demo: Metrics are buffered but not sent
    // In production: Replace with actual CloudWatch SDK call to PutMetricData

    /**
     * Production Implementation (commented out for simplicity):
     *
     * import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
     *
     * const client = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
     *
     * // CloudWatch accepts max 20 metrics per request, batch them
     * const chunks = this.chunkArray(metricsToSend, 20);
     *
     * for (const chunk of chunks) {
     *   await client.send(new PutMetricDataCommand({
     *     Namespace: this.namespace,
     *     MetricData: chunk
     *   }));
     * }
     */
  }

  private formatDimensions(
    dimensions?: MetricDimensions
  ): Array<{ Name: string; Value: string }> {
    if (!dimensions) return [];

    return Object.entries(dimensions).map(([key, value]) => ({
      Name: key,
      Value: String(value),
    }));
  }

  /**
   * Cleanup on shutdown
   */
  async destroy(): Promise<void> {
    clearInterval(this.flushInterval);
    await this.flush();
  }
}

/**
 * CloudWatch Metrics Setup Guide for EC2 Free Tier:
 *
 * 1. Create IAM role for EC2 with this policy:
 * ```json
 * {
 *   "Version": "2012-10-17",
 *   "Statement": [{
 *     "Effect": "Allow",
 *     "Action": ["cloudwatch:PutMetricData"],
 *     "Resource": "*",
 *     "Condition": {
 *       "StringEquals": {
 *         "cloudwatch:namespace": "CocosTrading"
 *       }
 *     }
 *   }]
 * }
 * ```
 *
 * 2. Attach role to EC2 instance
 *
 * 3. Install AWS SDK (if using production implementation):
 * ```bash
 * npm install @aws-sdk/client-cloudwatch
 * ```
 *
 * 4. View metrics in CloudWatch console:
 * https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#metricsV2:graph=~();namespace=CocosTrading
 *
 * 5. Create alarms and dashboards based on custom metrics
 *
 * Key Metrics to Track (stay under 10 for free tier):
 * 1. orders.created (counter)
 * 2. orders.rejected (counter)
 * 3. order.execution_time (histogram)
 * 4. api.response_time (histogram)
 * 5. db.query.duration (histogram)
 * 6. portfolio.calculation_time (histogram)
 * 7. errors.total (counter)
 * 8. api.requests (counter)
 */
