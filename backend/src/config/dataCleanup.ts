const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MAX_BATCHES_PER_TARGET = 10;

function readBoundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const configured = process.env[name]?.trim();
  if (!configured) return fallback;
  const value = Number(configured);
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  return value;
}

function readBoolean(name: string, fallback: boolean) {
  const configured = process.env[name]?.trim().toLowerCase();
  if (!configured) return fallback;
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

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
