import type { Logger } from 'pino';
import type { DataCleanupConfig } from '@/config/dataCleanup';
import {
  cleanupTargets,
  type CleanupTarget,
  type DataCleanupRepository,
} from '@/repositories/dataCleanupRepository';

const DAY_MS = 24 * 60 * 60 * 1000;

const retentionMs: Record<CleanupTarget, number> = {
  sessions: 7 * DAY_MS,
  accountTokens: 7 * DAY_MS,
  pendingEmailChanges: DAY_MS,
  readNotifications: 30 * DAY_MS,
  unreadNotifications: 180 * DAY_MS,
  carts: 30 * DAY_MS,
};

export type CleanupTargetResult = {
  rows: number;
  batches: number;
  limitReached: boolean;
};

export type DataCleanupResult = {
  now: Date;
  dryRun: boolean;
  targets: Record<CleanupTarget, CleanupTargetResult>;
};

function cutoffFor(target: CleanupTarget, now: Date) {
  return new Date(now.getTime() - retentionMs[target]);
}

function emptyResults(): Record<CleanupTarget, CleanupTargetResult> {
  return Object.fromEntries(
    cleanupTargets.map((target) => [
      target,
      { rows: 0, batches: 0, limitReached: false },
    ]),
  ) as Record<CleanupTarget, CleanupTargetResult>;
}

export async function runDataCleanup(
  repository: DataCleanupRepository,
  config: DataCleanupConfig,
  now: Date,
  applicationLogger?: Pick<Logger, 'info'>,
): Promise<DataCleanupResult> {
  const startedAt = Date.now();
  const targets = emptyResults();
  applicationLogger?.info({
    event: 'data_cleanup_started',
    cleanupAt: now.toISOString(),
    dryRun: config.dryRun,
    batchSize: config.batchSize,
    maxBatchesPerTarget: config.maxBatchesPerTarget,
  });

  for (const target of cleanupTargets) {
    const cutoff = cutoffFor(target, now);
    if (config.dryRun) {
      const preview = await repository.previewEligible(
        target,
        cutoff,
        config.batchSize,
      );
      targets[target] = {
        rows: preview.count,
        batches: 0,
        limitReached: preview.limitReached,
      };
      continue;
    }

    let lastBatchSize = 0;
    while (targets[target].batches < config.maxBatchesPerTarget) {
      lastBatchSize = await repository.deleteEligible(
        target,
        cutoff,
        config.batchSize,
      );
      targets[target].rows += lastBatchSize;
      targets[target].batches += 1;
      if (lastBatchSize < config.batchSize) break;
    }
    targets[target].limitReached =
      targets[target].batches === config.maxBatchesPerTarget &&
      lastBatchSize === config.batchSize;
  }

  const result = { now, dryRun: config.dryRun, targets };
  applicationLogger?.info({
    event: 'data_cleanup_completed',
    cleanupAt: now.toISOString(),
    dryRun: config.dryRun,
    durationMs: Date.now() - startedAt,
    targets,
  });
  return result;
}
