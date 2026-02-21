import { AppError } from './AppError';

/**
 * Not Found Error (404)
 * Thrown when a requested resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}
