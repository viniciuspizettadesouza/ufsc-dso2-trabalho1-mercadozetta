const AppError = require('../../../src/errors/AppError');
const errorHandler = require('../../../src/middleware/errorHandler');

function createResponse() {
    return {
        headersSent: false,
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
    };
}

describe('errorHandler', () => {
    it('delegates when headers were already sent', () => {
        const error = new Error('late');
        const res = createResponse();
        const next = vi.fn();
        res.headersSent = true;

        errorHandler(error, {}, res, next);

        expect(next).toHaveBeenCalledWith(error);
        expect(res.status).not.toHaveBeenCalled();
    });

    it('serializes AppError instances with optional details', () => {
        const res = createResponse();

        errorHandler(new AppError(400, 'BAD_INPUT', 'Bad input', { field: 'email' }), {}, res, vi.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            error: 'Bad input',
            code: 'BAD_INPUT',
            details: { field: 'email' },
        });
    });

    it('maps invalid JSON parser errors to a 400 response', () => {
        const res = createResponse();

        errorHandler({ type: 'entity.parse.failed' }, {}, res, vi.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            error: 'Invalid JSON payload',
            code: 'INVALID_JSON_PAYLOAD',
        });
    });

    it('hides unexpected errors behind a generic 500 response', () => {
        const res = createResponse();

        errorHandler(new Error('database exploded'), {}, res, vi.fn());

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.send).toHaveBeenCalledWith({
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
        });
    });
});
