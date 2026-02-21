import { User } from '@/models';

/**
 * User Repository Interface
 * Defines the contract for user data access operations
 */
export interface IUserRepository {
  /**
   * Find a user by their ID
   * @param userId - The user's ID
   * @returns Promise resolving to User or null if not found
   */
  findUserById(userId: number): Promise<User | null>;
}
