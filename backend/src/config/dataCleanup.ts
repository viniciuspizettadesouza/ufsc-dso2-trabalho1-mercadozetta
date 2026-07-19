import { readBoolean, readBoundedInteger } from '@/config/environment';

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MAX_BATCHES_PER_TARGET = 10;

export type DataCleanupConfig = {
  batchSize: number;
  maxBatchesPerTarget: number;
  dryRun: boolean;
};

export function getDataCleanupConfig(): DataCleanupConfig {
  return {
    batchSize: readBoundedInteger(
      'DATA_CLEANUP_BATCH_SIZE',
      DEFAULT_BATCH_SIZE,
      1,
      1000,
    ),
    maxBatchesPerTarget: readBoundedInteger(
      'DATA_CLEANUP_MAX_BATCHES_PER_TARGET',
      DEFAULT_MAX_BATCHES_PER_TARGET,
      1,
      100,
    ),
    dryRun: readBoolean('DATA_CLEANUP_DRY_RUN', true),
  };
}
