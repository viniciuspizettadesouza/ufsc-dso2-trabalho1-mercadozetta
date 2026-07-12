import { describe, expect, it, vi } from 'vitest';

import AppError from '../src/errors/AppError';
import errorHandler from '../src/middleware/errorHandler';
import validateRequest from '../src/middleware/validateRequest';

describe('request middleware', () => {
  it('stores validated request data and forwards errors through the shared middleware', () => {
    const req: any = {
      body: { name: 'x' },
      params: { id: '1' },
      query: { q: 'bike' },
      validated: {},
    };
    const res: any = {};
    const next = vi.fn();
    const schema = {
      body: vi.fn().mockReturnValue({ name: 'x' }),
      params: vi.fn().mockReturnValue({ id: '1' }),
      query: vi.fn().mockReturnValue({ q: 'bike' }),
    };

    validateRequest(schema)(req, res, next);

    expect(schema.body).toHaveBeenCalledWith(req.body);
    expect(schema.params).toHaveBeenCalledWith(req.params);
    expect(schema.query).toHaveBeenCalledWith(req.query);
    expect(req.validated).toEqual({
      body: { name: 'x' },
      params: { id: '1' },
      query: { q: 'bike' },
    });
    expect(next).toHaveBeenCalledTimes(1);

    const errorResponse = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    const errorNext = vi.fn();

    errorHandler(
      new AppError(422, 'VALIDATION_ERROR', 'Invalid payload'),
      {} as any,
      errorResponse as any,
      errorNext,
    );

    expect(errorResponse.status).toHaveBeenCalledWith(422);
    expect(errorResponse.send).toHaveBeenCalledWith({
      error: 'Invalid payload',
      code: 'VALIDATION_ERROR',
    });
  });
});
