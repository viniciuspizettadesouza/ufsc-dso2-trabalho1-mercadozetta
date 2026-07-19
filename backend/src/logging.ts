import type { Request, Response } from 'express';
import pino, { type DestinationStream, type Logger } from 'pino';
import pinoHttp from 'pino-http';

const redactedValue = '[REDACTED]';

const redactPaths = [
  'authorization',
  'cookie',
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'csrfToken',
  'csrfProof',
  'csrf',
  '*.authorization',
  '*.cookie',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.csrf',
  '*.accessToken',
  '*.refreshToken',
  '*.csrfToken',
  '*.csrfProof',
  'headers.authorization',
  'headers.cookie',
  'headers.x-csrf-token',
  'headers.idempotency-key',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.x-csrf-token',
  'req.headers.idempotency-key',
  'body.password',
  'body.passwordHash',
  'body.token',
  'body.accessToken',
  'body.refreshToken',
  'body.csrf',
  'body.csrfToken',
  'body.csrfProof',
];

export function createLogger(destination?: DestinationStream, level = 'info') {
  return pino(
    {
      level,
      redact: { paths: redactPaths, censor: redactedValue },
      serializers: { err: pino.stdSerializers.err },
      base: {
        service: 'mercadozetta-api',
        environment: process.env.NODE_ENV || 'development',
      },
    },
    destination,
  );
}

export const logger = createLogger();

function routePattern(req: Request) {
  const path = req.route?.path;
  return typeof path === 'string'
    ? `${req.baseUrl}${path}` || '/'
    : 'unmatched';
}

function requestFields(req: Request, res: Response, durationMs: number) {
  return {
    event: 'http_request_completed',
    requestId: req.requestId,
    method: req.method,
    route: routePattern(req),
    statusCode: res.statusCode,
    durationMs,
    ...(req.tenant ? { tenantId: req.tenant.id } : {}),
    ...(req.userId ? { userId: req.userId } : {}),
  };
}

export function createHttpLogger(
  applicationLogger: Logger = logger,
  autoLogging = process.env.NODE_ENV !== 'test',
) {
  return pinoHttp<Request, Response>({
    logger: applicationLogger,
    genReqId: (req) => req.requestId || req.id,
    customAttributeKeys: { reqId: 'requestId' },
    quietReqLogger: true,
    quietResLogger: true,
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessObject: (req, res, value) =>
      requestFields(req, res, value.responseTime),
    customErrorObject: (req, res, error, value) => ({
      ...requestFields(req, res, value.responseTime),
      err: error,
    }),
    customSuccessMessage: () => 'request completed',
    customErrorMessage: () => 'request failed',
    autoLogging,
  });
}

export const httpLogger = createHttpLogger();
