import { z } from 'zod';
import { ORDER_TYPES, ORDER_SIDES } from '@/constants/instruments';
import { ORDER_LIMITS } from '@/config/businessRules';

/**
 * Order creation validation schema
 *
 * Business rules (enforced from config):
 * - Must specify either 'size' (exact shares) OR 'amount' (total ARS), not both
 * - Size must be between MIN_ORDER_SIZE and MAX_ORDER_SIZE (from businessRules.ts)
 * - Amount must not exceed MAX_ORDER_AMOUNT (from businessRules.ts)
 * - LIMIT orders MUST include 'price'
 * - MARKET orders should NOT include 'price'
 * - BUY and SELL orders require instrumentId
 * - All numbers must be positive
 */
export const createOrderSchema = z
  .object({
    userId: z.number().int().positive(),
    instrumentId: z.number().int().positive(),
    side: z.enum([
      ORDER_SIDES.BUY,
      ORDER_SIDES.SELL,
      ORDER_SIDES.CASH_IN,
      ORDER_SIDES.CASH_OUT,
    ]),
    type: z.enum([ORDER_TYPES.MARKET, ORDER_TYPES.LIMIT]),
    // Size limits prevent abuse and unrealistic positions
    size: z
      .number()
      .int()
      .min(ORDER_LIMITS.MIN_ORDER_SIZE, {
        message: `Order size must be at least ${ORDER_LIMITS.MIN_ORDER_SIZE} share(s)`,
      })
      .max(ORDER_LIMITS.MAX_ORDER_SIZE, {
        message: `Order size cannot exceed ${ORDER_LIMITS.MAX_ORDER_SIZE} shares`,
      })
      .optional(),
    // Amount limit prevents massive orders and system abuse
    amount: z
      .number()
      .positive()
      .max(ORDER_LIMITS.MAX_ORDER_AMOUNT, {
        message: `Order amount cannot exceed ${ORDER_LIMITS.MAX_ORDER_AMOUNT} ARS`,
      })
      .optional(),
    price: z.number().positive().optional(),
  })
  .refine(
    (data) => {
      // Must specify either size OR amount, not both or neither
      return (data.size !== undefined) !== (data.amount !== undefined);
    },
    {
      message: 'Must specify either "size" or "amount", not both',
      path: ['size'],
    }
  )
  .refine(
    (data) => {
      // LIMIT orders must have price
      if (data.type === ORDER_TYPES.LIMIT && !data.price) {
        return false;
      }
      return true;
    },
    {
      message: 'LIMIT orders must include "price"',
      path: ['price'],
    }
  )
  .refine(
    (data) => {
      // MARKET orders should not have price
      if (data.type === ORDER_TYPES.MARKET && data.price !== undefined) {
        return false;
      }
      return true;
    },
    {
      message: 'MARKET orders should not include "price"',
      path: ['price'],
    }
  );

export type CreateOrderDTO = z.infer<typeof createOrderSchema>;
