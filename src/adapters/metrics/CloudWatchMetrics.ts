/**
 * AWS CloudWatch Metrics Adapter
 *
 * Metrics implementation that sends custom metrics to AWS CloudWatch.
 * Suitable for production deployments on AWS (EC2, ECS, Lambda, etc.)
 *
 * Features:
 * - Custom metrics in CloudWatch for monitoring and alerting
 * - Automatic batching to reduce API calls (max 20 metrics per request)
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
 * - Automatic batching reduces API calls significantly
 */

import { IMetrics, MetricDimensions } from '@/interfaces/IMetrics';
import { logger } from '@/adapters/logging/LoggerFactory';
import {
  CloudWatchClient,
  PutMetricDataCommand,
  MetricDatum,
} from '@aws-sdk/client-cloudwatch';
import { env } from '@/config/env';

/**
 * CloudWatch Metrics - Production Implementation
 *
 * Sends custom metrics to AWS CloudWatch for monitoring and alerting.
 * Metrics are batched and sent every 60 seconds to reduce API calls.
 */
export class CloudWatchMetrics implements IMetrics {
  private namespace: string;
  private buffer: MetricDatum[] = [];
  private flushInterval: NodeJS.Timeout;
  private client: CloudWatchClient;

  constructor(namespace: string = 'CocosTrading') {
    this.namespace = namespace;
    this.client = new CloudWatchClient({
      region: env.AWS_REGION || 'us-east-1',
    });

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

    try {
      // CloudWatch accepts max 20 metrics per request, batch them
      const chunks = this.chunkArray(metricsToSend, 20);

      for (const chunk of chunks) {
        const command = new PutMetricDataCommand({
          Namespace: this.namespace,
          MetricData: chunk,
        });

        await this.client.send(command);
      }

      logger.debug(
        { count: metricsToSend.length, namespace: this.namespace },
        'Flushed metrics to CloudWatch'
      );
    } catch (error) {
      logger.error(
        { error, count: metricsToSend.length },
        'Failed to send metrics to CloudWatch'
      );
      // Don't re-throw - we don't want to crash the app if CloudWatch is unavailable
    }
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
   * Helper method to split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
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
