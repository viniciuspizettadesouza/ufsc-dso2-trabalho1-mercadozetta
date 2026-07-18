import type { RequestFieldValue } from '@/types/request';
import { UUID_EXAMPLE } from '@/ids';
import { z } from 'zod';
import { parseAppSchema, requestString } from '@/validators/parseSchema';

export type CreateUserRequestBody = {
  email?: RequestFieldValue;
  password?: RequestFieldValue;
  username?: RequestFieldValue;
  telephone?: RequestFieldValue;
};

const userIdResponseSchema = z.string().uuid().meta({ example: UUID_EXAMPLE });

export const userResponseSchema = z
  .object({
    _id: userIdResponseSchema,
    tenantId: z.string(),
    email: z.email(),
    username: z.string().nullable(),
    telephone: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'User' });

export const sellerProfileResponseSchema = z
  .object({
    _id: userIdResponseSchema,
    username: z.string().nullable(),
    telephone: z.string().nullable(),
    email: z.email(),
    storeName: z.string(),
  })
  .meta({ id: 'SellerProfile' });

export const userErrorCodes = {
  create: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_REQUEST',
    'MISSING_USER_FIELDS',
    'INVALID_EMAIL',
    'WEAK_PASSWORD',
    'USER_EXISTS',
  ],
  rateLimit: ['REGISTER_RATE_LIMITED'],
  sellerDetail: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_SELLER_ID',
  ],
  sellerNotFound: ['SELLER_NOT_FOUND'],
} as const;

export const userInvalidRequestExample = {
  error: 'Invalid input: expected object, received string',
  code: 'INVALID_REQUEST',
} as const;

export const createUserSchema = z
  .object({
    email: z.unknown().optional(),
    password: z.unknown().optional(),
    username: z.unknown().optional(),
    telephone: z.unknown().optional(),
  })
  .transform((body) => ({
    email: requestString(body.email).trim().toLowerCase(),
    password: requestString(body.password),
    username: requestString(body.username).trim(),
    telephone: requestString(body.telephone).trim(),
  }))
  .refine(
    (user) =>
      Boolean(user.email && user.password && user.username && user.telephone),
    {
      message: 'Email, password, username and telephone are required',
      params: { appCode: 'MISSING_USER_FIELDS', statusCode: 400 },
    },
  )
  .refine((user) => !user.email || isValidEmail(user.email), {
    message: 'Invalid email',
    params: { appCode: 'INVALID_EMAIL', statusCode: 400 },
  })
  .refine((user) => !user.password || isStrongPassword(user.password), {
    message: 'Password must be at least 8 characters long',
    params: { appCode: 'WEAK_PASSWORD', statusCode: 400 },
  })
  .meta({
    id: 'CreateUserRequest',
    description: 'Details required to register a marketplace account.',
    override: {
      type: 'object',
      required: ['email', 'password', 'username', 'telephone'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
        username: { type: 'string' },
        telephone: { type: 'string' },
      },
    },
  });

export type CreateUserData = z.infer<typeof createUserSchema>;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password: string) {
  return password.length >= 8;
}

export function validateCreateUserPayload(
  body: CreateUserRequestBody = {},
): CreateUserData {
  return parseAppSchema(createUserSchema, body);
}
