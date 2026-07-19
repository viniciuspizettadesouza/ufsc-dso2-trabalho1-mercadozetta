import type { RequestFieldValue } from '@/types/request';
import { z } from 'zod';
import { parseAppSchema, requestString } from '@/validators/parseSchema';
import { isStrongPassword, isValidEmail } from '@/validators/userValidator';

export type AccountRequestBody = {
  email?: RequestFieldValue;
};

export type AccountTokenConfirmationBody = {
  token?: RequestFieldValue;
};

export type PasswordResetConfirmationBody = AccountTokenConfirmationBody & {
  password?: RequestFieldValue;
  passwordConfirmation?: RequestFieldValue;
};

export const accountRequestResponseSchema = z
  .object({
    message: z.literal(
      'If an eligible account exists, instructions will be sent.',
    ),
  })
  .meta({ id: 'AccountRequestResponse' });

export const accountSecurityErrorCodes = {
  request: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_REQUEST',
    'MISSING_EMAIL',
    'INVALID_EMAIL',
  ],
  tokenConfirmation: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_REQUEST',
    'INVALID_OR_EXPIRED_ACCOUNT_TOKEN',
  ],
  passwordResetConfirmation: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_REQUEST',
    'INVALID_OR_EXPIRED_ACCOUNT_TOKEN',
    'MISSING_PASSWORD_FIELDS',
    'PASSWORD_CONFIRMATION_MISMATCH',
    'WEAK_PASSWORD',
  ],
  origin: ['INVALID_ORIGIN'],
  unavailable: ['ACCOUNT_DELIVERY_UNAVAILABLE'],
  emailVerificationRequestRateLimit: [
    'EMAIL_VERIFICATION_REQUEST_RATE_LIMITED',
  ],
  emailVerificationConfirmationRateLimit: [
    'EMAIL_VERIFICATION_CONFIRMATION_RATE_LIMITED',
  ],
  passwordResetRequestRateLimit: ['PASSWORD_RESET_REQUEST_RATE_LIMITED'],
  passwordResetConfirmationRateLimit: [
    'PASSWORD_RESET_CONFIRMATION_RATE_LIMITED',
  ],
} as const;

export const accountSecurityInvalidRequestExample = {
  error: 'Invalid input: expected object, received string',
  code: 'INVALID_REQUEST',
} as const;

export const accountRequestSchema = z
  .object({ email: z.unknown().optional() })
  .transform((body) => ({
    email: requestString(body.email).trim().toLowerCase(),
  }))
  .refine(({ email }) => Boolean(email), {
    message: 'Email is required',
    params: { appCode: 'MISSING_EMAIL', statusCode: 400 },
  })
  .refine(({ email }) => !email || isValidEmail(email), {
    message: 'Invalid email',
    params: { appCode: 'INVALID_EMAIL', statusCode: 400 },
  })
  .meta({
    id: 'AccountRequest',
    description: 'Email used for a non-enumerating account-security request.',
    override: {
      type: 'object',
      required: ['email'],
      properties: { email: { type: 'string', format: 'email' } },
    },
  });

export const accountTokenConfirmationSchema = z
  .object({ token: z.unknown().optional() })
  .transform((body) => ({ token: requestString(body.token).trim() }))
  .refine(({ token }) => Boolean(token), {
    message: 'Invalid or expired account token',
    params: {
      appCode: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN',
      statusCode: 400,
    },
  })
  .meta({
    id: 'AccountTokenConfirmation',
    description: 'Opaque single-use account-security token.',
    override: {
      type: 'object',
      required: ['token'],
      properties: { token: { type: 'string', minLength: 1 } },
    },
  });

export const passwordResetConfirmationSchema = z
  .object({
    token: z.unknown().optional(),
    password: z.unknown().optional(),
    passwordConfirmation: z.unknown().optional(),
  })
  .transform((body) => ({
    token: requestString(body.token).trim(),
    password: requestString(body.password),
    passwordConfirmation: requestString(body.passwordConfirmation),
  }))
  .refine(({ token }) => Boolean(token), {
    message: 'Invalid or expired account token',
    params: {
      appCode: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN',
      statusCode: 400,
    },
  })
  .refine(
    ({ password, passwordConfirmation }) =>
      Boolean(password && passwordConfirmation),
    {
      message: 'Password and confirmation are required',
      params: { appCode: 'MISSING_PASSWORD_FIELDS', statusCode: 400 },
    },
  )
  .refine(
    ({ password, passwordConfirmation }) => {
      return (
        !password || !passwordConfirmation || password === passwordConfirmation
      );
    },
    {
      message: 'Password confirmation does not match',
      params: { appCode: 'PASSWORD_CONFIRMATION_MISMATCH', statusCode: 400 },
    },
  )
  .refine(({ password }) => !password || isStrongPassword(password), {
    message: 'Password must be at least 8 characters long',
    params: { appCode: 'WEAK_PASSWORD', statusCode: 400 },
  })
  .meta({
    id: 'PasswordResetConfirmation',
    description: 'Single-use reset token and matching replacement password.',
    override: {
      type: 'object',
      required: ['token', 'password', 'passwordConfirmation'],
      properties: {
        token: { type: 'string', minLength: 1 },
        password: { type: 'string', minLength: 8 },
        passwordConfirmation: { type: 'string', minLength: 8 },
      },
    },
  });

export type AccountRequestData = z.infer<typeof accountRequestSchema>;
export type AccountTokenConfirmationData = z.infer<
  typeof accountTokenConfirmationSchema
>;
export type PasswordResetConfirmationData = z.infer<
  typeof passwordResetConfirmationSchema
>;

export function validateAccountRequest(
  body: AccountRequestBody = {},
): AccountRequestData {
  return parseAppSchema(accountRequestSchema, body);
}

export function validateAccountTokenConfirmation(
  body: AccountTokenConfirmationBody = {},
): AccountTokenConfirmationData {
  return parseAppSchema(accountTokenConfirmationSchema, body);
}

export function validatePasswordResetConfirmation(
  body: PasswordResetConfirmationBody = {},
): PasswordResetConfirmationData {
  return parseAppSchema(passwordResetConfirmationSchema, body);
}
