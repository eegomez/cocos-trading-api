-- Migration: Add Reserved Cash Support for LIMIT Orders
-- Status: NOT APPLIED (documentation only)
--
-- Problem: LIMIT orders don't reserve cash when created
-- This allows users to create multiple pending orders exceeding their balance
--
-- Solution: Add reserved_cash column to track cash committed to pending orders

ALTER TABLE orders
ADD COLUMN reserved_cash NUMERIC(12, 2) DEFAULT 0 NOT NULL;

-- Index for efficient reserved cash lookups by user
CREATE INDEX idx_orders_userid_reserved ON orders(userid) WHERE reserved_cash > 0;

-- Update getUserAvailableCash to subtract reserved_cash
-- availableCash = cashBalance - SUM(reserved_cash)
