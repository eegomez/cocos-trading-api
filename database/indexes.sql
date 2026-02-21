-- Critical Database Indexes for Performance
-- Only includes indexes for known bottlenecks in hot paths

-- Order validation queries (used on every order execution)
CREATE INDEX IF NOT EXISTS idx_orders_userid_status ON orders(userid, status);

-- Market data lookups (used on every MARKET order + search)
CREATE INDEX IF NOT EXISTS idx_marketdata_instrumentid_date ON marketdata(instrumentid, date DESC);

-- Cursor pagination for order history
CREATE INDEX IF NOT EXISTS idx_orders_datetime_desc ON orders(datetime DESC);

-- Order-instrument joins (GET /orders/:id)
CREATE INDEX IF NOT EXISTS idx_orders_instrumentid ON orders(instrumentid);

-- User orders with pagination (composite index for efficient scans)
CREATE INDEX IF NOT EXISTS idx_orders_userid_datetime_desc ON orders(userid, datetime DESC);
