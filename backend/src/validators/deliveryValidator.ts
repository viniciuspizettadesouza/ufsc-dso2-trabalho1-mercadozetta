import { z } from 'zod';

import { UUID_EXAMPLE } from '@/ids';
import { parseAppSchema, requestString } from '@/validators/parseSchema';

const normalizedOptional = (value: unknown) => {
  const normalized = requestString(value).trim();
  return normalized || null;
};

export const deliveryAddressRequestSchema = z
  .object({
    label: z.unknown().optional(),
    recipientName: z.unknown().optional(),
    line1: z.unknown().optional(),
    line2: z.unknown().optional(),
    city: z.unknown().optional(),
    region: z.unknown().optional(),
    postalCode: z.unknown().optional(),
    countryCode: z.unknown().optional(),
    telephone: z.unknown().optional(),
    isDefault: z.boolean().optional().default(false),
  })
  .transform((value) => ({
    label: requestString(value.label).trim(),
    recipientName: requestString(value.recipientName).trim(),
    line1: requestString(value.line1).trim(),
    line2: normalizedOptional(value.line2),
    city: requestString(value.city).trim(),
    region: normalizedOptional(value.region),
    postalCode: requestString(value.postalCode).trim().toUpperCase(),
    countryCode: requestString(value.countryCode).trim().toUpperCase(),
    telephone: requestString(value.telephone).trim(),
    isDefault: value.isDefault,
  }))
  .refine(
    (value) =>
      Boolean(
        value.label &&
        value.recipientName &&
        value.line1 &&
        value.city &&
        value.postalCode &&
        value.countryCode &&
        value.telephone,
      ),
    {
      message: 'Required delivery-address fields are missing',
      params: { appCode: 'MISSING_ADDRESS_FIELDS', statusCode: 400 },
    },
  )
  .refine(
    (value) =>
      value.label.length <= 80 &&
      value.recipientName.length <= 160 &&
      value.line1.length <= 200 &&
      (value.line2?.length ?? 0) <= 200 &&
      value.city.length <= 120 &&
      (value.region?.length ?? 0) <= 120 &&
      value.telephone.length >= 5 &&
      value.telephone.length <= 40,
    {
      message: 'Delivery-address field length is invalid',
      params: { appCode: 'INVALID_ADDRESS', statusCode: 400 },
    },
  )
  .refine((value) => /^[A-Z]{2}$/.test(value.countryCode), {
    message: 'Country code must use two uppercase letters',
    params: { appCode: 'INVALID_ADDRESS', statusCode: 400 },
  })
  .refine(
    (value) => {
      if (value.countryCode === 'PT')
        return /^\d{4}-\d{3}$/.test(value.postalCode);
      if (value.countryCode === 'US')
        return /^\d{5}(?:-\d{4})?$/.test(value.postalCode);
      return /^[A-Z0-9][A-Z0-9 -]{1,18}[A-Z0-9]$/.test(value.postalCode);
    },
    {
      message: 'Postal code is invalid for the selected country',
      params: { appCode: 'INVALID_POSTAL_CODE', statusCode: 400 },
    },
  )
  .meta({
    id: 'DeliveryAddressRequest',
    description:
      'A tenant/user-scoped delivery address. PT and US postal formats are validated syntactically without claiming deliverability.',
    override: {
      type: 'object',
      required: [
        'label',
        'recipientName',
        'line1',
        'city',
        'postalCode',
        'countryCode',
        'telephone',
      ],
      properties: {
        label: { type: 'string', maxLength: 80 },
        recipientName: { type: 'string', maxLength: 160 },
        line1: { type: 'string', maxLength: 200 },
        line2: { type: ['string', 'null'], maxLength: 200 },
        city: { type: 'string', maxLength: 120 },
        region: { type: ['string', 'null'], maxLength: 120 },
        postalCode: { type: 'string', maxLength: 20 },
        countryCode: { type: 'string', pattern: '^[A-Z]{2}$' },
        telephone: { type: 'string', minLength: 5, maxLength: 40 },
        isDefault: { type: 'boolean', default: false },
      },
    },
  });

export const deliveryAddressResponseSchema = z
  .object({
    _id: z.string().uuid().meta({ example: UUID_EXAMPLE }),
    tenantId: z.string(),
    userId: z.string().uuid(),
    label: z.string(),
    recipientName: z.string(),
    line1: z.string(),
    line2: z.string().nullable(),
    city: z.string(),
    region: z.string().nullable(),
    postalCode: z.string(),
    countryCode: z.string().length(2),
    telephone: z.string(),
    isDefault: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'DeliveryAddress' });

export const deliveryAddressListResponseSchema = z
  .array(deliveryAddressResponseSchema)
  .meta({ id: 'DeliveryAddressList' });

export const checkoutSelectionSchema = z
  .object({
    addressId: z.string().uuid(),
    deliveryOptionId: z.enum(['standard', 'express']),
  })
  .strict()
  .meta({ id: 'CheckoutSelection' });

export const checkoutOrderRequestSchema = checkoutSelectionSchema
  .extend({ quoteId: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict()
  .meta({ id: 'CheckoutOrderRequest' });

export const deliveryOptionResponseSchema = z
  .object({
    id: z.enum(['standard', 'express']),
    label: z.string(),
    estimate: z.string(),
    shipping: z.object({
      currency: z.string().length(3),
      amountMinor: z.string().regex(/^\d+$/),
    }),
  })
  .meta({ id: 'DeliveryOption' });

export const checkoutQuoteResponseSchema = z
  .object({
    quoteId: z.string().regex(/^[a-f0-9]{64}$/),
    address: deliveryAddressResponseSchema,
    deliveryOption: deliveryOptionResponseSchema,
    subtotal: deliveryOptionResponseSchema.shape.shipping,
    discount: deliveryOptionResponseSchema.shape.shipping,
    shipping: deliveryOptionResponseSchema.shape.shipping,
    total: deliveryOptionResponseSchema.shape.shipping,
  })
  .meta({ id: 'CheckoutQuote' });

export type DeliveryAddressData = z.infer<typeof deliveryAddressRequestSchema>;
export type CheckoutSelection = z.infer<typeof checkoutSelectionSchema>;
export type CheckoutOrderRequest = z.infer<typeof checkoutOrderRequestSchema>;

export const deliveryErrorCodes = {
  request: [
    'TENANT_HEADER_REQUIRED',
    'INVALID_TENANT',
    'INVALID_REQUEST',
    'MISSING_ADDRESS_FIELDS',
    'INVALID_ADDRESS',
    'INVALID_POSTAL_CODE',
  ],
  path: ['TENANT_HEADER_REQUIRED', 'INVALID_TENANT', 'INVALID_RESOURCE_ID'],
  authentication: ['AUTH_TOKEN_REQUIRED', 'INVALID_AUTH_TOKEN'],
  csrf: ['INVALID_ORIGIN', 'INVALID_CSRF_TOKEN'],
  notFound: ['DELIVERY_ADDRESS_NOT_FOUND'],
} as const;

export function validateDeliveryAddress(body: unknown): DeliveryAddressData {
  return parseAppSchema(deliveryAddressRequestSchema, body);
}

export function validateCheckoutSelection(body: unknown): CheckoutSelection {
  return parseAppSchema(checkoutSelectionSchema, body);
}

export function validateCheckoutOrderRequest(
  body: unknown,
): CheckoutOrderRequest {
  return parseAppSchema(checkoutOrderRequestSchema, body);
}
