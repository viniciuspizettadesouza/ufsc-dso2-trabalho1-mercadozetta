import { afterEach, describe, expect, it } from 'vitest';
import { getDataCleanupConfig } from '@/config/dataCleanup';

const originalEnv = process.env;

describe('data cleanup configuration', () => {
  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses bounded safe defaults', () => {
    process.env = {};
    expect(getDataCleanupConfig()).toEqual({
      batchSize: 100,
      maxBatchesPerTarget: 10,
      dryRun: true,
    });
  });

  it('accepts explicit production settings', () => {
    process.env = {
      DATA_CLEANUP_BATCH_SIZE: '250',
      DATA_CLEANUP_MAX_BATCHES_PER_TARGET: '20',
      DATA_CLEANUP_DRY_RUN: 'false',
    };
    expect(getDataCleanupConfig()).toEqual({
      batchSize: 250,
      maxBatchesPerTarget: 20,
      dryRun: false,
    });
  });

  it.each([
    ['DATA_CLEANUP_BATCH_SIZE', '0', 'integer between 1 and 1000'],
    ['DATA_CLEANUP_BATCH_SIZE', '1.5', 'integer between 1 and 1000'],
    ['DATA_CLEANUP_MAX_BATCHES_PER_TARGET', '101', 'integer between 1 and 100'],
    ['DATA_CLEANUP_DRY_RUN', 'yes', 'must be true or false'],
  ])('rejects invalid %s', (name, value, message) => {
    process.env = { [name]: value };
    expect(() => getDataCleanupConfig()).toThrow(message);
  });
});
