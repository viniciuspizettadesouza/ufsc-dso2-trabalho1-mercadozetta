import { describe, expect, it, vi } from 'vitest';
import { cleanupTargets } from '@/repositories/dataCleanupRepository';
import { runDataCleanup } from '@/services/dataCleanupService';

const now = new Date('2026-08-01T00:00:00.000Z');

describe('data cleanup service', () => {
  it('previews one bounded batch per target without deleting', async () => {
    const repository = {
      deleteEligible: vi.fn(),
      previewEligible: vi
        .fn()
        .mockResolvedValue({ count: 5, limitReached: true }),
    };
    const logger = { info: vi.fn() };

    const result = await runDataCleanup(
      repository,
      { batchSize: 5, maxBatchesPerTarget: 3, dryRun: true },
      now,
      logger as never,
    );

    expect(repository.previewEligible).toHaveBeenCalledTimes(
      cleanupTargets.length,
    );
    expect(repository.deleteEligible).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.targets.sessions).toEqual({
      rows: 5,
      batches: 0,
      limitReached: true,
    });
    expect(repository.previewEligible).toHaveBeenCalledWith(
      'sessions',
      new Date('2026-07-25T00:00:00.000Z'),
      5,
    );
    expect(repository.previewEligible).toHaveBeenCalledWith(
      'pendingEmailChanges',
      new Date('2026-07-31T00:00:00.000Z'),
      5,
    );
    expect(repository.previewEligible).toHaveBeenCalledWith(
      'unreadNotifications',
      new Date('2026-02-02T00:00:00.000Z'),
      5,
    );
    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  it('deletes in bounded batches and stops after a short batch', async () => {
    const calls = new Map<string, number>();
    const repository = {
      previewEligible: vi.fn(),
      deleteEligible: vi.fn(async (target: string) => {
        const call = (calls.get(target) || 0) + 1;
        calls.set(target, call);
        return call === 1 ? 2 : 1;
      }),
    };

    const result = await runDataCleanup(
      repository,
      { batchSize: 2, maxBatchesPerTarget: 3, dryRun: false },
      now,
    );

    expect(repository.deleteEligible).toHaveBeenCalledTimes(
      cleanupTargets.length * 2,
    );
    for (const target of cleanupTargets)
      expect(result.targets[target]).toEqual({
        rows: 3,
        batches: 2,
        limitReached: false,
      });
  });

  it('reports a target that reaches its per-run batch limit', async () => {
    const repository = {
      previewEligible: vi.fn(),
      deleteEligible: vi.fn().mockResolvedValue(2),
    };

    const result = await runDataCleanup(
      repository,
      { batchSize: 2, maxBatchesPerTarget: 1, dryRun: false },
      now,
    );

    expect(result.targets.carts).toEqual({
      rows: 2,
      batches: 1,
      limitReached: true,
    });
  });

  it('propagates repository failure without logging completion', async () => {
    const repository = {
      previewEligible: vi.fn(),
      deleteEligible: vi.fn().mockRejectedValue(new Error('delete failed')),
    };
    const logger = { info: vi.fn() };

    await expect(
      runDataCleanup(
        repository,
        { batchSize: 2, maxBatchesPerTarget: 1, dryRun: false },
        now,
        logger as never,
      ),
    ).rejects.toThrow('delete failed');
    expect(logger.info).toHaveBeenCalledOnce();
  });
});
