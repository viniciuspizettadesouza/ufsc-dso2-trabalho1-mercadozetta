import type { RequestFieldValue } from '../types/request';
import { z } from 'zod';
import { parseAppSchema, requestString } from './parseSchema';

export type LoginRequestBody = {
  email?: RequestFieldValue;
  password?: RequestFieldValue;
};

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
