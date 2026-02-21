import { AppError } from './AppError';

/**
 * Validation Error (400 Bad Request)
 * Thrown when request payload is invalid
 */
export class ValidationError extends AppError {
  public readonly errors?: unknown;

  constructor(message: string, errors?: unknown) {
    super(message, 400);
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
