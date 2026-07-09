const asyncHandler = require('../../../src/middleware/asyncHandler');

describe('asyncHandler', () => {
    it('passes through resolved handlers', async () => {
        const req = {};
        const res = {};
        const next = vi.fn();
        const handler = vi.fn().mockResolvedValue('done');

        await expect(asyncHandler(handler)(req, res, next)).resolves.toBe('done');

        expect(handler).toHaveBeenCalledWith(req, res, next);
        expect(next).not.toHaveBeenCalled();
    });

    it('forwards rejected handlers to next', async () => {
        const error = new Error('boom');
        const next = vi.fn();
        const handler = vi.fn().mockRejectedValue(error);

        await asyncHandler(handler)({}, {}, next);

        expect(next).toHaveBeenCalledWith(error);
    });
});
