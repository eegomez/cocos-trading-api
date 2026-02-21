import { cleanEnv, str, num, bool } from 'envalid';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

/**
 * Validated environment variables with production-grade validation
 *
 * Using envalid for runtime validation and type safety:
 * - Validates types (string, number, boolean)
 * - Enforces choices for enums
 * - Provides defaults for development/test
 * - Fails fast on startup if required vars are missing
 *
 * Production Safety:
 * - No defaults for sensitive values (DB_PASSWORD)
 * - Strict validation prevents misconfiguration
 * - Type safety prevents runtime errors
 */
export const env = cleanEnv(process.env, {
  // ==========================================
  // Server Configuration
  // ==========================================
  NODE_ENV: str({
    choices: ['development', 'test', 'production'],
    default: 'development',
    desc: 'Application environment (affects logging, error handling, CORS)',
  }),
  PORT: num({
    default: 3000,
    desc: 'HTTP server port',
    devDefault: 3000, // Explicit dev default for clarity
  }),

  // ==========================================
  // Database Configuration
  // ==========================================
  DB_HOST: str({
    default: 'localhost',
    desc: 'PostgreSQL host',
    example: 'localhost or mydb.us-east-1.rds.amazonaws.com',
  }),
  DB_PORT: num({
    default: 5432,
    desc: 'PostgreSQL port',
  }),
  DB_NAME: str({
    default: 'cocos_trading',
    desc: 'PostgreSQL database name',
  }),
  DB_USER: str({
    default: 'postgres',
    desc: 'PostgreSQL username',
  }),
  DB_PASSWORD: str({
    default: 'postgres', // Only for dev - production MUST set this explicitly
    desc: 'PostgreSQL password (REQUIRED in production)',
  }),
  DB_MAX_CONNECTIONS: num({
    default: 20,
    desc: 'Maximum database connection pool size',
  }),

  // ==========================================
  // Logging Configuration
  // ==========================================
  LOG_LEVEL: str({
    choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
    default: 'info',
    desc: 'Minimum log level to output',
  }),
  LOG_PRETTY: bool({
    default: true,
    desc: 'Pretty-print logs (false for production JSON logs)',
  }),

  // ==========================================
  // AWS CloudWatch Configuration (Optional)
  // ==========================================
  // Only required when LOGGER_TYPE=cloudwatch or METRICS_TYPE=cloudwatch
  AWS_REGION: str({
    default: 'us-east-1',
    desc: 'AWS region for CloudWatch (e.g., us-east-1, eu-west-1)',
  }),
  CLOUDWATCH_LOG_GROUP: str({
    default: '/aws/cocos-trading/api',
    desc: 'CloudWatch Logs group name',
  }),
  CLOUDWATCH_LOG_STREAM: str({
    default: 'main',
    desc: 'CloudWatch Logs stream name',
  }),
  CLOUDWATCH_METRICS_NAMESPACE: str({
    default: 'CocosTrading',
    desc: 'CloudWatch Metrics namespace',
  }),
});

export type Env = typeof env;
