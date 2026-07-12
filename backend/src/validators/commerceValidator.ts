import { z } from 'zod';
import { orderStatuses } from '../orderStatus';
import { parseAppSchema, requestString } from './parseSchema';

const objectId = z
  .unknown()
  .transform((value) => requestString(value).trim())
  .refine((value) => /^[a-f\d]{24}$/i.test(value), {
    message: 'Invalid resource id',
    params: { appCode: 'INVALID_RESOURCE_ID', statusCode: 400 },
  });

const cartItemSchema = z.object({
  productId: objectId,
  quantity: z.coerce.number().int().min(1).default(1),
});

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(1000),
});

const statusSchema = z.object({ status: z.enum(orderStatuses) });

export const validateResourceId = (value: unknown) =>
  parseAppSchema(objectId, value);
export const validateCartItem = (value: object) =>
  parseAppSchema(cartItemSchema, value);
export const validateReview = (value: object) =>
  parseAppSchema(reviewSchema, value);
export const validateOrderStatus = (value: object) =>
  parseAppSchema(statusSchema, value);
