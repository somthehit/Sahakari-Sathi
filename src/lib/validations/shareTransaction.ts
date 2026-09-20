/**
 * Share Transaction Validation (शेयर कारोबार)
 * Single Zod schema powering BOTH the unified Issue/Return form on the frontend
 * and the POST /shares/transaction handler on the backend, so the two can never
 * drift apart.
 *
 *  - ISSUE  -> member buys new shares (no balance ceiling beyond share class max)
 *  - RETURN -> member refunds shares; enforced numberOfShares <= current balance
 *
 * `memberCurrentBalance` is an OPTIONAL client-supplied snapshot used purely for
 * a fast frontend refinement. The backend ALWAYS re-fetches the authoritative
 * balance from the DB inside the transaction, so a tampered value is harmless.
 */
import { z } from 'zod';

export const SHARE_TRANSACTION_TYPES = ['ISSUE', 'RETURN'] as const;
export type ShareTransactionType = (typeof SHARE_TRANSACTION_TYPES)[number];

export const shareTransactionSchema = z.object({
  transactionType: z.enum(SHARE_TRANSACTION_TYPES),
  memberId: z.uuid('Member is required'),
  shareTypeId: z.uuid('Share class is required'),
  numberOfShares: z.coerce
    .number()
    .int('Number of shares must be a whole number')
    .positive('Number of shares must be greater than zero'),
  memberCurrentBalance: z.coerce.number().int().nonnegative().optional(),
  dateBs: z.string().optional(),
  dateAd: z.string().optional(),
  remarks: z.string().max(500, 'Remarks must be under 500 characters').optional().nullable(),
  branchId: z.uuid().optional().nullable(),
  /** Payment/refund COA account chosen by the operator (Dr on ISSUE, Cr on RETURN). */
  paymentAccountId: z.uuid().optional().nullable(),
  /** Manual kitta range — required when the share type's autoSequence is OFF. */
  manualStartKitta: z.coerce.number().int().positive().optional().nullable(),
  manualEndKitta: z.coerce.number().int().positive().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.transactionType === 'RETURN' && typeof data.memberCurrentBalance === 'number') {
    if (data.numberOfShares > data.memberCurrentBalance) {
      ctx.addIssue({
        code: 'custom',
        path: ['numberOfShares'],
        message: `Cannot return ${data.numberOfShares} shares — the member's current balance is only ${data.memberCurrentBalance} shares.`,
      });
    }
  }
  const hasStart = data.manualStartKitta != null;
  const hasEnd = data.manualEndKitta != null;
  if (hasStart !== hasEnd) {
    ctx.addIssue({
      code: 'custom',
      path: ['manualStartKitta'],
      message: 'Both the manual kitta start and end must be provided together.',
    });
  }
  if (hasStart && hasEnd && Number(data.manualStartKitta) > Number(data.manualEndKitta)) {
    ctx.addIssue({
      code: 'custom',
      path: ['manualStartKitta'],
      message: 'Manual kitta start cannot exceed end.',
    });
  }
});

export type ShareTransactionInput = z.infer<typeof shareTransactionSchema>;

/**
 * HTTP request wrapper matching the validateRequest middleware contract:
 *   { body, query, params }
 */
export const shareTransactionRequestSchema = z.object({
  body: shareTransactionSchema,
});
