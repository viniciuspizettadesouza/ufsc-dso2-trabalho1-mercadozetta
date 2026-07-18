import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import type { DestinationStream } from 'pino';
import { describe, expect, it } from 'vitest';
import AppError from '@/errors/AppError';
import errorHandler from '@/middleware/errorHandler';
import requestContext from '@/middleware/requestContext';
import { createHttpLogger, createLogger } from '@/logging';

function captureLogs() {
  const lines: string[] = [];
  const destination = {
    write(chunk: string) {
      lines.push(chunk);
    },
  } as DestinationStream;

  return { lines, logger: createLogger(destination) };
}

function requestAndResponse(
  method: string,
  route?: string,
  headers: Record<string, string> = {},
) {
  const req = {
    method,
    baseUrl: '',
    ...(route ? { route: { path: route } } : {}),
    headers,
  } as unknown as Request;
  class MockResponse extends EventEmitter {
    statusCode = 200;
    headersSent = false;

    setHeader() {}

    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    }

    send() {
      this.emit('finish');
      return this;
    }
  }
  const res = new MockResponse() as unknown as Response;

  return { req, res };
}

describe('structured logging', () => {
  it('redacts credentials and security proofs from application log objects', () => {
    const { lines, logger } = captureLogs();

    logger.info({
      authorization: 'Bearer secret-access-token',
      headers: {
        cookie: 'access=secret-cookie',
        'x-csrf-token': 'secret-csrf-proof',
      },
      body: {
        password: 'secret-password',
        refreshToken: 'secret-refresh-token',
      },
    });

    const serialized = lines.join('');
    expect(serialized).not.toContain('secret-');
    expect(serialized).toContain('[REDACTED]');
  });

  it('emits the safe production request schema with correlation and auth context', () => {
    const { lines, logger } = captureLogs();
    const { req, res } = requestAndResponse('GET', '/products/:productId', {
      'x-request-id': 'request-123',
      cookie: 'access=secret-cookie',
      authorization: 'Bearer secret-access-token',
      'x-csrf-token': 'secret-csrf-proof',
    });

    requestContext(req, res, () => undefined);
    createHttpLogger(logger, true)(req, res, () => undefined);
    req.tenant = { id: 'mercadozetta', name: 'MercadoZetta', active: true };
    req.userId = '607f1f77-bcf8-4ecd-8994-390120000002';
    res.statusCode = 204;
    res.emit('finish');

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({
      level: 30,
      service: 'mercadozetta-api',
      environment: 'test',
      event: 'http_request_completed',
      requestId: 'request-123',
      method: 'GET',
      route: '/products/:productId',
      statusCode: 204,
      tenantId: 'mercadozetta',
      userId: '607f1f77-bcf8-4ecd-8994-390120000002',
      msg: 'request completed',
    });
    expect(entry.durationMs).toEqual(expect.any(Number));
    expect(lines[0]).not.toContain('secret-');
  });

  it('logs unexpected errors at error level without changing the API response', () => {
    const { lines, logger } = captureLogs();
    const { req, res } = requestAndResponse('GET', '/failure');

    requestContext(req, res, () => undefined);
    createHttpLogger(logger, true)(req, res, () => undefined);
    errorHandler(new Error('database unavailable'), req, res, () => undefined);

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({
      level: 50,
      event: 'http_request_completed',
      route: '/failure',
      statusCode: 500,
      msg: 'request failed',
      err: {
        type: 'Error',
        message: 'database unavailable',
      },
    });
  });

  it('logs rejected unmatched requests at warn level without auth context', () => {
    const { lines, logger } = captureLogs();
    const { req, res } = requestAndResponse('POST');

    requestContext(req, res, () => undefined);
    createHttpLogger(logger, true)(req, res, () => undefined);
    errorHandler(
      new AppError(400, 'BAD_INPUT', 'Bad input'),
      req,
      res,
      () => undefined,
    );

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({
      level: 40,
      event: 'http_request_completed',
      method: 'POST',
      route: 'unmatched',
      statusCode: 400,
      msg: 'request completed',
    });
    expect(entry).not.toHaveProperty('tenantId');
    expect(entry).not.toHaveProperty('userId');
    expect(entry).not.toHaveProperty('err');
  });
});
