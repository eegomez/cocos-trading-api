import { AppError } from './AppError';

/**
 * Business Rule Error (422 Unprocessable Entity)
 * Thrown when request is valid but violates business rules
 * Examples: insufficient funds, selling more shares than owned
 */
export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 422);
    Object.setPrototypeOf(this, BusinessRuleError.prototype);
  }
}
