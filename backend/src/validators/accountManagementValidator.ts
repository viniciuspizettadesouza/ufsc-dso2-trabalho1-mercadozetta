import type { RequestFieldValue } from '@/types/request';
import { z } from 'zod';
import { parseAppSchema, requestString } from '@/validators/parseSchema';
import { isStrongPassword } from '@/validators/userValidator';
import { isValidEmail } from '@/validators/userValidator';

export const emailChangeRequestResponseSchema = z
  .object({
    message: z.literal(
      'If the address can be used, confirmation instructions will be sent.',
    ),
  })
  .meta({ id: 'EmailChangeRequestResponse' });

export const accountManagementErrorCodes = {
  tenant: ['TENANT_HEADER_REQUIRED', 'INVALID_TENANT'],
  authentication: ['AUTH_TOKEN_REQUIRED', 'INVALID_AUTH_TOKEN'],
  csrf: ['INVALID_ORIGIN', 'INVALID_CSRF_TOKEN'],
  origin: ['INVALID_ORIGIN'],
  profileRequest: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_REQUEST',
    'MISSING_PROFILE_UPDATE_FIELDS',
  ],
  passwordRequest: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_REQUEST',
    'MISSING_PASSWORD_CHANGE_FIELDS',
    'PASSWORD_CONFIRMATION_MISMATCH',
    'WEAK_PASSWORD',
    'PASSWORD_REUSE_NOT_ALLOWED',
  ],
  emailRequest: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_REQUEST',
    'MISSING_EMAIL_CHANGE_FIELDS',
    'INVALID_EMAIL',
  ],
  deactivationRequest: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_REQUEST',
    'DEACTIVATION_CONFIRMATION_MISMATCH',
  ],
  reauthentication: [
    'INVALID_ORIGIN',
    'INVALID_CSRF_TOKEN',
    'REAUTHENTICATION_FAILED',
  ],
  profileConflict: ['ACCOUNT_STATE_CHANGED'],
  emailConflict: [
    'ACCOUNT_STATE_CHANGED',
    'EMAIL_UNCHANGED',
    'EMAIL_UNAVAILABLE',
  ],
  deactivationConflict: [
    'ACCOUNT_STATE_CHANGED',
    'ACCOUNT_DEACTIVATION_BLOCKED_ACTIVE_ORDERS',
  ],
  confirmation: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_REQUEST',
    'INVALID_OR_EXPIRED_ACCOUNT_TOKEN',
  ],
  passwordChangeRateLimit: ['PASSWORD_CHANGE_RATE_LIMITED'],
  emailChangeRequestRateLimit: ['EMAIL_CHANGE_REQUEST_RATE_LIMITED'],
  emailChangeConfirmationRateLimit: ['EMAIL_CHANGE_CONFIRMATION_RATE_LIMITED'],
  deactivationRateLimit: ['ACCOUNT_DEACTIVATION_RATE_LIMITED'],
  unavailable: ['ACCOUNT_DELIVERY_UNAVAILABLE'],
} as const;

export const accountManagementInvalidRequestExample = {
  error: 'Invalid input: expected object, received string',
  code: 'INVALID_REQUEST',
} as const;

export type ProfileUpdateRequestBody = {
  username?: RequestFieldValue;
  telephone?: RequestFieldValue;
};

export type PasswordChangeRequestBody = {
  currentPassword?: RequestFieldValue;
  password?: RequestFieldValue;
  passwordConfirmation?: RequestFieldValue;
};

export type EmailChangeRequestBody = {
  email?: RequestFieldValue;
  currentPassword?: RequestFieldValue;
};

export type AccountDeactivationRequestBody = {
  currentPassword?: RequestFieldValue;
  confirmation?: RequestFieldValue;
};

export const profileUpdateSchema = z
  .object({
    username: z.string().trim().min(1).max(80).optional(),
    telephone: z.union([z.string().trim().min(1).max(32), z.null()]).optional(),
  })
  .strict()
  .refine(
    (body) => body.username !== undefined || body.telephone !== undefined,
    {
      message: 'At least one editable profile field is required',
      params: { appCode: 'MISSING_PROFILE_UPDATE_FIELDS', statusCode: 400 },
    },
  )
  .meta({
    id: 'ProfileUpdateRequest',
    description: 'Explicitly editable account profile fields.',
  });

export const passwordChangeSchema = z
  .object({
    currentPassword: z.unknown().optional(),
    password: z.unknown().optional(),
    passwordConfirmation: z.unknown().optional(),
  })
  .strict()
  .transform((body) => ({
    currentPassword: requestString(body.currentPassword),
    password: requestString(body.password),
    passwordConfirmation: requestString(body.passwordConfirmation),
  }))
  .refine(
    ({ currentPassword, password, passwordConfirmation }) =>
      Boolean(currentPassword && password && passwordConfirmation),
    {
      message: 'Current password, password and confirmation are required',
      params: { appCode: 'MISSING_PASSWORD_CHANGE_FIELDS', statusCode: 400 },
    },
  )
  .refine(
    ({ password, passwordConfirmation }) =>
      !password || !passwordConfirmation || password === passwordConfirmation,
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
    id: 'PasswordChangeRequest',
    description: 'Current credential and matching replacement password.',
    override: {
      type: 'object',
      required: ['currentPassword', 'password', 'passwordConfirmation'],
      properties: {
        currentPassword: { type: 'string' },
        password: { type: 'string', minLength: 8 },
        passwordConfirmation: { type: 'string', minLength: 8 },
      },
    },
  });

export const emailChangeRequestSchema = z
  .object({
    email: z.unknown().optional(),
    currentPassword: z.unknown().optional(),
  })
  .strict()
  .transform((body) => ({
    email: requestString(body.email).trim().toLowerCase(),
    currentPassword: requestString(body.currentPassword),
  }))
  .refine(({ email, currentPassword }) => Boolean(email && currentPassword), {
    message: 'Email and current password are required',
    params: { appCode: 'MISSING_EMAIL_CHANGE_FIELDS', statusCode: 400 },
  })
  .refine(({ email }) => !email || isValidEmail(email), {
    message: 'Invalid email',
    params: { appCode: 'INVALID_EMAIL', statusCode: 400 },
  })
  .meta({
    id: 'EmailChangeRequest',
    description: 'Proposed login email and current credential.',
    override: {
      type: 'object',
      required: ['email', 'currentPassword'],
      properties: {
        email: { type: 'string', format: 'email' },
        currentPassword: { type: 'string' },
      },
    },
  });

export const accountDeactivationSchema = z
  .object({
    currentPassword: z.unknown().optional(),
    confirmation: z.unknown().optional(),
  })
  .strict()
  .transform((body) => ({
    currentPassword: requestString(body.currentPassword),
    confirmation: requestString(body.confirmation),
  }))
  .refine(({ confirmation }) => confirmation === 'DEACTIVATE', {
    message: 'Confirmation must equal DEACTIVATE',
    params: {
      appCode: 'DEACTIVATION_CONFIRMATION_MISMATCH',
      statusCode: 400,
    },
  })
  .meta({
    id: 'AccountDeactivationRequest',
    description: 'Current credential and explicit deactivation confirmation.',
    override: {
      type: 'object',
      required: ['currentPassword', 'confirmation'],
      properties: {
        currentPassword: { type: 'string' },
        confirmation: { type: 'string', enum: ['DEACTIVATE'] },
      },
    },
  });

export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
export type PasswordChangeData = z.infer<typeof passwordChangeSchema>;
export type EmailChangeRequestData = z.infer<typeof emailChangeRequestSchema>;
export type AccountDeactivationData = z.infer<typeof accountDeactivationSchema>;

export function validateProfileUpdate(
  body: ProfileUpdateRequestBody = {},
): ProfileUpdateData {
  return parseAppSchema(profileUpdateSchema, body);
}

export function validatePasswordChange(
  body: PasswordChangeRequestBody = {},
): PasswordChangeData {
  return parseAppSchema(passwordChangeSchema, body);
}

export function validateEmailChangeRequest(
  body: EmailChangeRequestBody = {},
): EmailChangeRequestData {
  return parseAppSchema(emailChangeRequestSchema, body);
}

export function validateAccountDeactivation(
  body: AccountDeactivationRequestBody = {},
): AccountDeactivationData {
  return parseAppSchema(accountDeactivationSchema, body);
}
