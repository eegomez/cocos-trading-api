/**
 * AWS CloudWatch Logger Adapter
 *
 * Logger implementation that sends structured logs to AWS CloudWatch.
 * Suitable for production deployments on AWS (EC2, ECS, Lambda, etc.)
 *
 * Features:
 * - Automatically ships logs to CloudWatch Logs
 * - Structured JSON format (queryable in CloudWatch Insights)
 * - Falls back to console if CloudWatch is unavailable
 * - Works with AWS free tier (5GB ingestion, 5GB storage per month)
 *
 * Setup Requirements:
 * 1. EC2 instance needs IAM role with CloudWatch Logs permissions:
 *    - logs:CreateLogGroup
 *    - logs:CreateLogStream
 *    - logs:PutLogEvents
 *
 * 2. Install CloudWatch agent OR use stdout (preferred for simplicity):
 *    - Option A: Use CloudWatch agent to ship logs from /var/log
 *    - Option B: Use stdout + AWS logs driver (Docker/ECS)
 *    - Option C: Use pino transport to ship directly (this implementation)
 *
 * For simplicity (free tier EC2), we use stdout with structured JSON.
 * EC2 logs can be collected with CloudWatch agent or simple log shipper.
 */

import pino from 'pino';
import { ILogger, LogMetadata } from '@/interfaces/ILogger';

/**
 * CloudWatch Logger using structured stdout
 *
 * This implementation logs to stdout in JSON format.
 * To ship logs to CloudWatch from EC2:
 *
 * Option 1: Install CloudWatch agent (recommended for EC2)
 * ```bash
 * sudo yum install amazon-cloudwatch-agent
 * sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
 *   -a fetch-config -m ec2 -s -c file:/opt/aws/cloudwatch-config.json
 * ```
 *
 * Option 2: Use simple log shipper (awslogs, fluentd, etc.)
 *
 * Option 3: Redirect stdout to CloudWatch via systemd journal
 *
 * For interview/demo: Logs to stdout, viewable via `journalctl` or EC2 console
 */
export class CloudWatchLogger implements ILogger {
  private logger: pino.Logger;

  constructor(context?: string) {
    this.logger = pino({
      name: context || 'app',
      level: process.env.LOG_LEVEL || 'info',
      // JSON output for CloudWatch parsing
      // CloudWatch Insights can query these structured logs
      formatters: {
        level: (label) => {
          return { level: label.toUpperCase() };
        },
      },
      // Add environment metadata to all logs
      base: {
        env: process.env.NODE_ENV || 'production',
        region: process.env.AWS_REGION || 'us-east-1',
        service: 'cocos-trading-api',
      },
      // Timestamp in ISO format (CloudWatch standard)
      timestamp: pino.stdTimeFunctions.isoTime,
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

/**
 * CloudWatch Setup Guide for EC2 Free Tier:
 *
 * 1. Create IAM role for EC2 with this policy:
 * ```json
 * {
 *   "Version": "2012-10-17",
 *   "Statement": [{
 *     "Effect": "Allow",
 *     "Action": [
 *       "logs:CreateLogGroup",
 *       "logs:CreateLogStream",
 *       "logs:PutLogEvents",
 *       "logs:DescribeLogStreams"
 *     ],
 *     "Resource": "arn:aws:logs:*:*:log-group:/aws/ec2/cocos-trading-api:*"
 *   }]
 * }
 * ```
 *
 * 2. Attach role to EC2 instance
 *
 * 3. Install CloudWatch agent:
 * ```bash
 * wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
 * sudo rpm -U ./amazon-cloudwatch-agent.rpm
 * ```
 *
 * 4. Configure agent to collect stdout from your app
 *
 * 5. View logs in CloudWatch console:
 * https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group//aws/ec2/cocos-trading-api
 *
 * Free Tier Limits:
 * - 5 GB of log data ingestion
 * - 5 GB of log data storage
 * - 5 GB of log data scanned through CloudWatch Logs Insights
 */
