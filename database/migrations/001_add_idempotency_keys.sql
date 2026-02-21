-- Migration: Add Idempotency Keys Support
-- Status: NOT APPLIED (documentation only)
--
-- Purpose: Prevent duplicate order creation from network retries
-- Client sends UUID in Idempotency-Key header
-- Server checks if order with this key exists, returns existing order if found

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  created_at TIMESTAMP DEFAULT NOW(),
  retry_count INT DEFAULT 0
);

-- Index for TTL cleanup (delete keys older than 24h)
CREATE INDEX idx_idempotency_created ON idempotency_keys(created_at);

-- Cleanup job (run daily)
-- DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours';
