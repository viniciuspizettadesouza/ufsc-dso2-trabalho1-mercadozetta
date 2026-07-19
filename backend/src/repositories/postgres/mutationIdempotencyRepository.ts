import { and, eq } from 'drizzle-orm';
import type { Database } from '@/database/postgres';
import { mutationIdempotency } from '@/database/schema';
import type {
  MutationIdempotencyClaim,
  MutationIdempotencyRepository,
} from '@/repositories/mutationIdempotencyRepository';

type TransactionDatabase = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

export class PostgresMutationIdempotencyRepository implements MutationIdempotencyRepository {
  constructor(private readonly db: Database | TransactionDatabase) {}

  private predicate(input: Omit<MutationIdempotencyClaim, 'now'>) {
    return and(
      eq(mutationIdempotency.tenantId, input.tenantId),
      eq(mutationIdempotency.actorId, input.actorId),
      eq(mutationIdempotency.operation, input.operation),
      eq(mutationIdempotency.key, input.key),
    );
  }

  async claim(input: MutationIdempotencyClaim) {
    const inserted = await this.db
      .insert(mutationIdempotency)
      .values({
        tenantId: input.tenantId,
        actorId: input.actorId,
        operation: input.operation,
        key: input.key,
        requestHash: input.requestHash,
        createdAt: input.now,
      })
      .onConflictDoNothing()
      .returning({ key: mutationIdempotency.key });
    if (inserted.length) return { outcome: 'claimed' as const };

    const [existing] = await this.db
      .select()
      .from(mutationIdempotency)
      .where(this.predicate(input))
      .limit(1)
      .for('update');
    if (!existing || existing.requestHash !== input.requestHash)
      return { outcome: 'conflict' as const };
    if (!existing.resourceId)
      throw new Error('Idempotency record committed without a resource');
    return { outcome: 'replay' as const, resourceId: existing.resourceId };
  }

  async complete(
    input: Omit<MutationIdempotencyClaim, 'now'> & { resourceId: string },
  ) {
    const updated = await this.db
      .update(mutationIdempotency)
      .set({ resourceId: input.resourceId })
      .where(
        and(
          this.predicate(input),
          eq(mutationIdempotency.requestHash, input.requestHash),
        ),
      )
      .returning({ key: mutationIdempotency.key });
    if (updated.length !== 1)
      throw new Error('Idempotency record completion failed');
  }
}
