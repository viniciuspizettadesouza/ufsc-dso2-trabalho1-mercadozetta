export type IdempotentOperation = 'product.create' | 'review.upsert';

export type MutationIdempotencyClaim = {
  tenantId: string;
  actorId: string;
  operation: IdempotentOperation;
  key: string;
  requestHash: string;
  now: Date;
};

export type MutationIdempotencyResult =
  | { outcome: 'claimed' }
  | { outcome: 'replay'; resourceId: string }
  | { outcome: 'conflict' };

export interface MutationIdempotencyRepository {
  claim(input: MutationIdempotencyClaim): Promise<MutationIdempotencyResult>;
  complete(
    input: Omit<MutationIdempotencyClaim, 'now'> & { resourceId: string },
  ): Promise<void>;
}
