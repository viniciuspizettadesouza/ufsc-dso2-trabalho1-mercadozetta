import { z } from 'zod';

const errorResponseShape = {
  error: z.string(),
  code: z.string(),
  details: z.unknown().optional(),
};

export const errorResponseSchema = z
  .object(errorResponseShape)
  .meta({ id: 'Error' });

export const appErrorExamples = {
  TENANT_HEADER_REQUIRED: {
    error: 'X-Tenant-Id header is required',
    code: 'TENANT_HEADER_REQUIRED',
  },
  INVALID_TENANT: { error: 'Invalid tenant', code: 'INVALID_TENANT' },
  INVALID_REQUEST: {
    error:
      'Invalid option: expected one of "draft"|"active"|"paused"|"sold_out"|"archived"',
    code: 'INVALID_REQUEST',
  },
  INVALID_PRODUCT_ID: {
    error: 'Invalid product id',
    code: 'INVALID_PRODUCT_ID',
  },
  INVALID_SELLER_ID: {
    error: 'Invalid seller id',
    code: 'INVALID_SELLER_ID',
  },
  MISSING_PRODUCT_FIELDS: {
    error: 'Name, quantity, price and image are required',
    code: 'MISSING_PRODUCT_FIELDS',
  },
  INVALID_PRODUCT_PRICE: {
    error: 'Product price must use canonical bounded minor units',
    code: 'INVALID_PRODUCT_PRICE',
  },
  INVALID_PRODUCT_CURRENCY: {
    error: 'Product price currency must match the tenant currency',
    code: 'INVALID_PRODUCT_CURRENCY',
  },
  INVALID_PRODUCT_INVENTORY: {
    error: 'Quantity must be a non-negative integer',
    code: 'INVALID_PRODUCT_INVENTORY',
  },
  INVALID_PRODUCT_STATUS: {
    error:
      'Product status must be draft, active, paused, sold_out, or archived',
    code: 'INVALID_PRODUCT_STATUS',
  },
  INVALID_PRODUCT_STATUS_INVENTORY: {
    error: 'Sold-out products must have zero inventory',
    code: 'INVALID_PRODUCT_STATUS_INVENTORY',
  },
  INVALID_PRODUCT_IMAGE_URL: {
    error: 'Product image must use an allowed HTTPS host or a relative path',
    code: 'INVALID_PRODUCT_IMAGE_URL',
  },
  MISSING_PRODUCT_UPDATE_FIELDS: {
    error: 'At least one editable product field is required',
    code: 'MISSING_PRODUCT_UPDATE_FIELDS',
  },
  INVALID_PRODUCT_STATUS_FILTER: {
    error:
      'Product status filter must be draft, active, paused, sold_out, or archived',
    code: 'INVALID_PRODUCT_STATUS_FILTER',
  },
  INVALID_PRODUCT_AVAILABILITY_FILTER: {
    error: 'Product availability filter must be in_stock or sold_out',
    code: 'INVALID_PRODUCT_AVAILABILITY_FILTER',
  },
  INVALID_PRODUCT_SORT: {
    error:
      'Product sort must be created_asc, created_desc, name_asc, or inventory_desc',
    code: 'INVALID_PRODUCT_SORT',
  },
  MISSING_CREDENTIALS: {
    error: 'Email and password are required',
    code: 'MISSING_CREDENTIALS',
  },
  INVALID_CREDENTIALS: {
    error: 'Invalid credentials',
    code: 'INVALID_CREDENTIALS',
  },
  AUTH_RATE_LIMITED: {
    error: 'Too many login attempts, please try again later',
    code: 'AUTH_RATE_LIMITED',
  },
  MISSING_USER_FIELDS: {
    error: 'Email, password, username and telephone are required',
    code: 'MISSING_USER_FIELDS',
  },
  INVALID_EMAIL: { error: 'Invalid email', code: 'INVALID_EMAIL' },
  MISSING_EMAIL: { error: 'Email is required', code: 'MISSING_EMAIL' },
  INVALID_OR_EXPIRED_ACCOUNT_TOKEN: {
    error: 'Invalid or expired account token',
    code: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN',
  },
  MISSING_PASSWORD_FIELDS: {
    error: 'Password and confirmation are required',
    code: 'MISSING_PASSWORD_FIELDS',
  },
  PASSWORD_CONFIRMATION_MISMATCH: {
    error: 'Password confirmation does not match',
    code: 'PASSWORD_CONFIRMATION_MISMATCH',
  },
  ACCOUNT_DELIVERY_UNAVAILABLE: {
    error: 'Account message delivery is unavailable',
    code: 'ACCOUNT_DELIVERY_UNAVAILABLE',
  },
  EMAIL_VERIFICATION_REQUEST_RATE_LIMITED: {
    error: 'Too many email verification requests, please try again later',
    code: 'EMAIL_VERIFICATION_REQUEST_RATE_LIMITED',
  },
  EMAIL_VERIFICATION_CONFIRMATION_RATE_LIMITED: {
    error: 'Too many email verification attempts, please try again later',
    code: 'EMAIL_VERIFICATION_CONFIRMATION_RATE_LIMITED',
  },
  PASSWORD_RESET_REQUEST_RATE_LIMITED: {
    error: 'Too many password reset requests, please try again later',
    code: 'PASSWORD_RESET_REQUEST_RATE_LIMITED',
  },
  PASSWORD_RESET_CONFIRMATION_RATE_LIMITED: {
    error: 'Too many password reset attempts, please try again later',
    code: 'PASSWORD_RESET_CONFIRMATION_RATE_LIMITED',
  },
  MISSING_PROFILE_UPDATE_FIELDS: {
    error: 'At least one editable profile field is required',
    code: 'MISSING_PROFILE_UPDATE_FIELDS',
  },
  MISSING_PASSWORD_CHANGE_FIELDS: {
    error: 'Current password, password and confirmation are required',
    code: 'MISSING_PASSWORD_CHANGE_FIELDS',
  },
  PASSWORD_REUSE_NOT_ALLOWED: {
    error: 'New password must differ from the current password',
    code: 'PASSWORD_REUSE_NOT_ALLOWED',
  },
  MISSING_EMAIL_CHANGE_FIELDS: {
    error: 'Email and current password are required',
    code: 'MISSING_EMAIL_CHANGE_FIELDS',
  },
  EMAIL_UNCHANGED: {
    error: 'New email must differ from the current email',
    code: 'EMAIL_UNCHANGED',
  },
  EMAIL_UNAVAILABLE: {
    error: 'Email is unavailable',
    code: 'EMAIL_UNAVAILABLE',
  },
  REAUTHENTICATION_FAILED: {
    error: 'Current password is incorrect',
    code: 'REAUTHENTICATION_FAILED',
  },
  ACCOUNT_STATE_CHANGED: {
    error: 'Account state changed; authenticate again',
    code: 'ACCOUNT_STATE_CHANGED',
  },
  DEACTIVATION_CONFIRMATION_MISMATCH: {
    error: 'Confirmation must equal DEACTIVATE',
    code: 'DEACTIVATION_CONFIRMATION_MISMATCH',
  },
  ACCOUNT_DEACTIVATION_BLOCKED_ACTIVE_ORDERS: {
    error: 'Account cannot be deactivated while active orders remain',
    code: 'ACCOUNT_DEACTIVATION_BLOCKED_ACTIVE_ORDERS',
  },
  PASSWORD_CHANGE_RATE_LIMITED: {
    error: 'Too many password change attempts, please try again later',
    code: 'PASSWORD_CHANGE_RATE_LIMITED',
  },
  EMAIL_CHANGE_REQUEST_RATE_LIMITED: {
    error: 'Too many email change attempts, please try again later',
    code: 'EMAIL_CHANGE_REQUEST_RATE_LIMITED',
  },
  EMAIL_CHANGE_CONFIRMATION_RATE_LIMITED: {
    error: 'Too many email change confirmations, please try again later',
    code: 'EMAIL_CHANGE_CONFIRMATION_RATE_LIMITED',
  },
  ACCOUNT_DEACTIVATION_RATE_LIMITED: {
    error: 'Too many account deactivation attempts, please try again later',
    code: 'ACCOUNT_DEACTIVATION_RATE_LIMITED',
  },
  WEAK_PASSWORD: {
    error: 'Password must be at least 8 characters long',
    code: 'WEAK_PASSWORD',
  },
  USER_EXISTS: { error: 'User already exists', code: 'USER_EXISTS' },
  REGISTER_RATE_LIMITED: {
    error: 'Too many account creation attempts, please try again later',
    code: 'REGISTER_RATE_LIMITED',
  },
  AUTH_TOKEN_REQUIRED: {
    error: 'Authorization token is required',
    code: 'AUTH_TOKEN_REQUIRED',
  },
  INVALID_AUTH_TOKEN: {
    error: 'Invalid authorization token',
    code: 'INVALID_AUTH_TOKEN',
  },
  COOKIE_SESSION_REQUIRED: {
    error: 'Cookie session is required',
    code: 'COOKIE_SESSION_REQUIRED',
  },
  INVALID_REFRESH_TOKEN: {
    error: 'Invalid refresh token',
    code: 'INVALID_REFRESH_TOKEN',
  },
  SESSION_EXPIRED: { error: 'Session expired', code: 'SESSION_EXPIRED' },
  REFRESH_TOKEN_REUSED: {
    error: 'Refresh token reuse detected',
    code: 'REFRESH_TOKEN_REUSED',
  },
  REFRESH_ALREADY_ROTATED: {
    error: 'Refresh token was already rotated',
    code: 'REFRESH_ALREADY_ROTATED',
  },
  INVALID_ORIGIN: {
    error: 'Request origin is invalid',
    code: 'INVALID_ORIGIN',
  },
  INVALID_CSRF_TOKEN: {
    error: 'CSRF token is invalid',
    code: 'INVALID_CSRF_TOKEN',
  },
  PRODUCT_FORBIDDEN: {
    error: 'Not authorized to manage this product',
    code: 'PRODUCT_FORBIDDEN',
  },
  PRODUCT_NOT_FOUND: {
    error: 'Product not found',
    code: 'PRODUCT_NOT_FOUND',
  },
  INSUFFICIENT_INVENTORY: {
    error: 'Insufficient product inventory',
    code: 'INSUFFICIENT_INVENTORY',
  },
  ORDER_TOTAL_LIMIT_EXCEEDED: {
    error: 'Order amount exceeds the supported limit',
    code: 'ORDER_TOTAL_LIMIT_EXCEEDED',
  },
  REVIEW_FORBIDDEN: {
    error: 'Sellers cannot review their own products',
    code: 'REVIEW_FORBIDDEN',
  },
  REVIEW_PURCHASE_REQUIRED: {
    error: 'Only buyers can review purchased products',
    code: 'REVIEW_PURCHASE_REQUIRED',
  },
  NOTIFICATION_NOT_FOUND: {
    error: 'Notification not found',
    code: 'NOTIFICATION_NOT_FOUND',
  },
  EMPTY_CART: { error: 'Cart is empty', code: 'EMPTY_CART' },
  IDEMPOTENCY_KEY_REQUIRED: {
    error: 'Idempotency-Key header is required',
    code: 'IDEMPOTENCY_KEY_REQUIRED',
  },
  INVALID_IDEMPOTENCY_KEY: {
    error: 'Idempotency-Key must be a UUID',
    code: 'INVALID_IDEMPOTENCY_KEY',
  },
  IDEMPOTENCY_KEY_REUSED: {
    error: 'Idempotency-Key was already used for a different request',
    code: 'IDEMPOTENCY_KEY_REUSED',
  },
  ORDER_FORBIDDEN: {
    error: 'Not authorized to update this order',
    code: 'ORDER_FORBIDDEN',
  },
  ORDER_NOT_FOUND: { error: 'Order not found', code: 'ORDER_NOT_FOUND' },
  ORDER_STATUS_TRANSITION_INVALID: {
    error: 'Order cannot transition to the requested status',
    code: 'ORDER_STATUS_TRANSITION_INVALID',
  },
  PRODUCT_STATUS_TRANSITION_INVALID: {
    error: 'Sold-out status is managed by inventory',
    code: 'PRODUCT_STATUS_TRANSITION_INVALID',
  },
  PRODUCT_INVENTORY_REQUIRED: {
    error: 'Active products require inventory',
    code: 'PRODUCT_INVENTORY_REQUIRED',
  },
  PRODUCT_PRICE_REQUIRED: {
    error: 'Active products require a price',
    code: 'PRODUCT_PRICE_REQUIRED',
  },
  INVALID_RESOURCE_ID: {
    error: 'Invalid resource id',
    code: 'INVALID_RESOURCE_ID',
  },
  SESSION_NOT_FOUND: {
    error: 'Session not found',
    code: 'SESSION_NOT_FOUND',
  },
  SELLER_NOT_FOUND: {
    error: 'Seller not found',
    code: 'SELLER_NOT_FOUND',
  },
} as const;

export type AppErrorExampleCode = keyof typeof appErrorExamples;
export type AppErrorExample = {
  error: string;
  code: AppErrorExampleCode;
};

export function errorResponseSchemaFor<
  const TCodes extends readonly [AppErrorExampleCode, ...AppErrorExampleCode[]],
>(codes: TCodes) {
  return z.object({
    ...errorResponseShape,
    code: z.enum(codes),
  });
}

export const pageInfoResponseSchema = z
  .object({
    limit: z.int().min(1).max(100),
    offset: z.int().min(0),
    total: z.int().min(0),
    hasMore: z.boolean(),
  })
  .meta({ id: 'PageInfo' });

export const paginatedResponseSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), page: pageInfoResponseSchema });
