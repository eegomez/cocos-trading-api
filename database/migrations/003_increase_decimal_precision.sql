-- Migration: Increase Decimal Precision for Monetary Values
-- Status: APPLIED (already in database.sql)
--
-- Change: NUMERIC(10, 2) → NUMERIC(12, 2)
-- Reason: Support high-value assets (stocks, currencies, crypto)
-- Impact: Minimal storage increase, no performance impact

ALTER TABLE orders
ALTER COLUMN price TYPE NUMERIC(12, 2);

ALTER TABLE marketdata
ALTER COLUMN high TYPE NUMERIC(12, 2),
ALTER COLUMN low TYPE NUMERIC(12, 2),
ALTER COLUMN open TYPE NUMERIC(12, 2),
ALTER COLUMN close TYPE NUMERIC(12, 2),
ALTER COLUMN previousClose TYPE NUMERIC(12, 2);
