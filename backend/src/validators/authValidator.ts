import type { RequestFieldValue } from '@/types/request';
import { z } from 'zod';
import { UUID_EXAMPLE } from '@/ids';
import { parseAppSchema, requestString } from '@/validators/parseSchema';
import { userResponseSchema } from '@/validators/userValidator';

export type LoginRequestBody = {
  email?: RequestFieldValue;
  password?: RequestFieldValue;
};

export const sessionResponseSchema = z
  .object({
    id: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    createdAt: z.iso.datetime(),
    lastUsedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    absoluteExpiresAt: z.iso.datetime(),
    userAgentLabel: z.string().optional(),
  })
  .meta({ id: 'Session' });

export const authStateResponseSchema = z
  .object({
    user: userResponseSchema,
    session: sessionResponseSchema,
  })
  .meta({ id: 'AuthStateResponse' });

export const sessionListResponseSchema = z
  .object({ sessions: z.array(sessionResponseSchema) })
  .meta({ id: 'SessionListResponse' });

export const authErrorCodes = {
  loginRequest: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_REQUEST',
    'MISSING_CREDENTIALS',
  ],
  invalidCredentials: ['INVALID_CREDENTIALS'],
  loginOrigin: ['INVALID_ORIGIN'],
  loginRateLimit: ['AUTH_RATE_LIMITED'],
  tenant: ['TENANT_HEADER_REQUIRED', 'INVALID_TENANT'],
  authentication: ['AUTH_TOKEN_REQUIRED', 'INVALID_AUTH_TOKEN'],
  sessionAuthentication: [
    'AUTH_TOKEN_REQUIRED',
    'INVALID_AUTH_TOKEN',
    'COOKIE_SESSION_REQUIRED',
  ],
  refreshAuthentication: [
    'INVALID_REFRESH_TOKEN',
    'SESSION_EXPIRED',
    'REFRESH_TOKEN_REUSED',
  ],
  csrf: ['INVALID_ORIGIN', 'INVALID_CSRF_TOKEN'],
  refreshConflict: ['REFRESH_ALREADY_ROTATED'],
  sessionId: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_RESOURCE_ID',
  ],
  sessionNotFound: ['SESSION_NOT_FOUND'],
} as const;

export const authInvalidRequestExample = {
  error: 'Invalid input: expected object, received string',
  code: 'INVALID_REQUEST',
} as const;

export const loginSchema = z
  .object({
    email: z.unknown().optional(),
    password: z.unknown().optional(),
  })
  .transform((body) => ({
    email: requestString(body.email).trim().toLowerCase(),
    password: requestString(body.password),
  }))
  .refine((credentials) => Boolean(credentials.email && credentials.password), {
    message: 'Email and password are required',
    params: { appCode: 'MISSING_CREDENTIALS', statusCode: 400 },
  })
  .meta({
    id: 'LoginRequest',
    description: 'Credentials used to create a tenant-bound session.',
    override: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string' },
      },
    },
  });

export type LoginCredentials = z.infer<typeof loginSchema>;

export function validateLoginPayload(
  body: LoginRequestBody = {},
): LoginCredentials {
  return parseAppSchema(loginSchema, body);
}
