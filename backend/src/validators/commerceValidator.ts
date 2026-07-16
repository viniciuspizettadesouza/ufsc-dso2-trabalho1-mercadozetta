import { z } from 'zod';
import { isUuid, UUID_EXAMPLE } from '@/ids';
import { orderStatuses } from '@/orderStatus';
import { parseAppSchema, requestString } from '@/validators/parseSchema';

export const resourceIdSchema = z
  .unknown()
  .transform((value) => requestString(value).trim().toLowerCase())
  .refine((value) => isUuid(value), {
    message: 'Invalid resource id',
    params: { appCode: 'INVALID_RESOURCE_ID', statusCode: 400 },
  })
  .meta({
    id: 'ResourceId',
    example: UUID_EXAMPLE,
    override: { type: 'string', format: 'uuid' },
  });

const cartItemSchema = z.object({
  productId: resourceIdSchema,
  quantity: z.coerce.number().int().min(1).default(1),
});

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(1000),
});

const statusSchema = z.object({ status: z.enum(orderStatuses) });
const notificationReadSchema = z.object({ read: z.boolean() });

export const validateResourceId = (value: unknown) =>
  parseAppSchema(resourceIdSchema, value);
export const validateCartItem = (value: object) =>
  parseAppSchema(cartItemSchema, value);
export const validateReview = (value: object) =>
  parseAppSchema(reviewSchema, value);
export const validateOrderStatus = (value: object) =>
  parseAppSchema(statusSchema, value);
export const validateNotificationRead = (value: object) =>
  parseAppSchema(notificationReadSchema, value);
