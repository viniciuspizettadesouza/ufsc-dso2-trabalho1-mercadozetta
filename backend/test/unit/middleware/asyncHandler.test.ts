import { describe, expect, it, vi } from 'vitest';
import asyncHandler from '@/middleware/asyncHandler';

describe('asyncHandler', () => {
  it('passes through resolved handlers', async () => {
    const req = {};
    const res = {};
    const next = vi.fn();
    const handler = vi.fn().mockResolvedValue('done');

    await expect(
      asyncHandler(handler)(req as any, res as any, next),
    ).resolves.toBe('done');

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards rejected handlers to next', async () => {
    const error = new Error('boom');
    const next = vi.fn();
    const handler = vi.fn().mockRejectedValue(error);

    await asyncHandler(handler)({} as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
