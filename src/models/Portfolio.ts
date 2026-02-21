/**
 * Portfolio position for a single instrument
 * Calculated from FILLED orders
 */
export interface Position {
  instrumentId: number;
  ticker: string;
  name: string;
  quantity: number;
  averageBuyPrice: number; // Cost basis
  currentPrice: number;
  marketValue: number; // quantity * currentPrice
  totalReturn: number; // Percentage return vs cost basis
  dailyReturn: number; // Percentage return vs previous close
}

/**
 * Complete portfolio for a user
 * Returned by GET /portfolio/:userId
 */
export interface Portfolio {
  userId: number;
  totalBalance: number; // availableCash + sum of all position market values
  availableCash: number; // Cash available to invest
  positions: Position[];
}

/**
 * Internal position data used during calculations
 * Before enrichment with market data
 */
export interface PositionCalculation {
  instrumentId: number;
  quantity: number;
  totalCost: number; // Sum of (size * price) for all BUY orders
}
