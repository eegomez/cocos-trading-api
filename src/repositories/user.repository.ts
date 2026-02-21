import { query } from '@/config/database';
import { User } from '@/models';
import { IUserRepository } from './interfaces/IUserRepository';

/**
 * User Repository
 * Handles all database operations for users
 */
export class UserRepository implements IUserRepository {
  /**
   * Find user by ID
   */
  async findUserById(userId: number): Promise<User | null> {
    const result = await query<User>(
      'SELECT id, email, accountnumber AS "accountNumber" FROM users WHERE id = $1',
      [userId]
    );

    return result.rows[0] || null;
  }
}
