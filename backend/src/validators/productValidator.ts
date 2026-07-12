import mongoose from 'mongoose';
import { productStatuses, type ProductStatus } from '../productStatus';
import type { RequestFieldValue } from '../types/request';
import { z } from 'zod';
import {
  firstDefined,
  hasRequestValue,
  parseAppSchema,
  requestString,
} from './parseSchema';

export type CreateProductRequestBody = {
  name?: RequestFieldValue;
  description?: RequestFieldValue;
  category?: RequestFieldValue;
  subcategory?: RequestFieldValue;
  inventory?: RequestFieldValue;
  quant?: RequestFieldValue;
  image?: RequestFieldValue;
  status?: RequestFieldValue;
};

export type ProductFilterQuery = {
  q?: RequestFieldValue;
  search?: RequestFieldValue;
  category?: RequestFieldValue;
  subcategory?: RequestFieldValue;
  seller?: RequestFieldValue;
  status?: RequestFieldValue;
  availability?: RequestFieldValue;
  sort?: RequestFieldValue;
};

function isProductStatus(status: string): status is ProductStatus {
  return productStatuses.includes(status as ProductStatus);
}

export const createProductSchema = z
  .object({
    name: z.unknown().optional(),
    description: z.unknown().optional(),
    category: z.unknown().optional(),
    subcategory: z.unknown().optional(),
    inventory: z.unknown().optional(),
    quant: z.unknown().optional(),
    image: z.unknown().optional(),
    status: z.unknown().optional(),
  })
  .transform((body) => {
    const rawInventory = firstDefined(body.inventory, body.quant);
    return {
      name: requestString(body.name).trim(),
      description: requestString(body.description).trim(),
      category: requestString(body.category, 'general').trim().toLowerCase(),
      subcategory: requestString(body.subcategory).trim().toLowerCase(),
      inventory: Number(rawInventory),
      image: requestString(body.image).trim(),
      status:
        body.status === undefined || body.status === null || body.status === ''
          ? 'active'
          : requestString(body.status).trim(),
      hasInventory: hasRequestValue(rawInventory),
    };
  })
  .refine(
    (product) => Boolean(product.name && product.hasInventory && product.image),
    {
      message: 'Name, quantity and image are required',
      params: { appCode: 'MISSING_PRODUCT_FIELDS', statusCode: 400 },
    },
  )
  .refine(
    (product) =>
      !product.hasInventory ||
      (Number.isInteger(product.inventory) && product.inventory >= 0),
    {
      message: 'Quantity must be a non-negative integer',
      params: { appCode: 'INVALID_PRODUCT_INVENTORY', statusCode: 400 },
    },
  )
  .refine((product) => isProductStatus(product.status), {
    message:
      'Product status must be draft, active, paused, sold_out, or archived',
    params: { appCode: 'INVALID_PRODUCT_STATUS', statusCode: 400 },
  })
  .transform(({ hasInventory, ...product }) => ({
    ...product,
    status: product.status as ProductStatus,
  }))
  .meta({
    id: 'CreateProductRequest',
    description: 'Details required to create a product listing.',
    override: {
      type: 'object',
      required: ['name', 'image'],
      anyOf: [{ required: ['inventory'] }, { required: ['quant'] }],
      properties: {
        name: { type: 'string' },
        description: { type: 'string', default: '' },
        category: { type: 'string', default: 'general' },
        subcategory: { type: 'string', default: '' },
        inventory: { type: 'integer', minimum: 0 },
        quant: {
          type: 'integer',
          minimum: 0,
          description: 'Legacy alias for inventory',
        },
        image: { type: 'string' },
        status: { type: 'string', enum: productStatuses, default: 'active' },
      },
    },
  });

export type CreateProductData = z.infer<typeof createProductSchema>;

export const productFiltersSchema = z
  .object({
    q: z
      .unknown()
      .optional()
      .meta({ override: { type: 'string' } }),
    search: z
      .unknown()
      .optional()
      .meta({
        description: 'Alias for q',
        override: { type: 'string' },
      }),
    category: z
      .unknown()
      .optional()
      .meta({ override: { type: 'string' } }),
    subcategory: z
      .unknown()
      .optional()
      .meta({ override: { type: 'string' } }),
    seller: z
      .unknown()
      .optional()
      .meta({ override: { type: 'string' } }),
    status: z
      .unknown()
      .optional()
      .meta({
        override: { type: 'string', enum: productStatuses },
      }),
    availability: z
      .unknown()
      .optional()
      .meta({
        override: { type: 'string', enum: ['in_stock', 'sold_out'] },
      }),
    sort: z
      .unknown()
      .optional()
      .meta({
        override: {
          type: 'string',
          enum: ['created_asc', 'created_desc', 'name_asc', 'inventory_desc'],
          default: 'created_desc',
        },
      }),
  })
  .transform((query) => ({
    q: requestString(query.q || query.search).trim(),
    category: requestString(query.category).trim().toLowerCase(),
    subcategory: requestString(query.subcategory).trim().toLowerCase(),
    seller: requestString(query.seller).trim(),
    status: requestString(query.status).trim(),
    availability: requestString(query.availability).trim(),
    sort: requestString(query.sort, 'created_desc').trim(),
  }))
  .refine((filters) => !filters.status || isProductStatus(filters.status), {
    message:
      'Product status filter must be draft, active, paused, sold_out, or archived',
    params: { appCode: 'INVALID_PRODUCT_STATUS_FILTER', statusCode: 400 },
  })
  .refine(
    (filters) =>
      !filters.availability ||
      ['in_stock', 'sold_out'].includes(filters.availability),
    {
      message: 'Product availability filter must be in_stock or sold_out',
      params: {
        appCode: 'INVALID_PRODUCT_AVAILABILITY_FILTER',
        statusCode: 400,
      },
    },
  )
  .refine(
    (filters) =>
      ['created_asc', 'created_desc', 'name_asc', 'inventory_desc'].includes(
        filters.sort,
      ),
    {
      message:
        'Product sort must be created_asc, created_desc, name_asc, or inventory_desc',
      params: { appCode: 'INVALID_PRODUCT_SORT', statusCode: 400 },
    },
  )
  .meta({
    id: 'ProductFilters',
    override: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        search: { type: 'string', description: 'Alias for q' },
        category: { type: 'string' },
        subcategory: { type: 'string' },
        seller: { type: 'string' },
        status: { type: 'string', enum: productStatuses },
        availability: { type: 'string', enum: ['in_stock', 'sold_out'] },
        sort: {
          type: 'string',
          enum: ['created_asc', 'created_desc', 'name_asc', 'inventory_desc'],
          default: 'created_desc',
        },
      },
    },
  });

export type ProductListFilters = z.infer<typeof productFiltersSchema>;

export const productIdSchema = z
  .unknown()
  .transform((value) => requestString(value).trim())
  .refine((id) => Boolean(id), {
    message: 'Invalid product id',
    params: { appCode: 'INVALID_PRODUCT_ID', statusCode: 400 },
  })
  .meta({
    id: 'ProductId',
    example: '507f191e810c19729de860ea',
    override: { type: 'string' },
  });

export const sellerIdSchema = z
  .string()
  .refine((id) => mongoose.Types.ObjectId.isValid(id), {
    message: 'Invalid seller id',
    params: { appCode: 'INVALID_SELLER_ID', statusCode: 400 },
  })
  .meta({ id: 'SellerId', example: '507f1f77bcf86cd799439011' });

export function validateCreateProductPayload(
  body: CreateProductRequestBody = {},
): CreateProductData {
  return parseAppSchema(createProductSchema, body);
}

export function validateProductFilters(
  query: ProductFilterQuery = {},
): ProductListFilters {
  return parseAppSchema(productFiltersSchema, query);
}

export function validateProductId(
  productId: string | number | null | undefined,
) {
  return parseAppSchema(productIdSchema, productId);
}

export function validateSellerId(userId: string) {
  return parseAppSchema(sellerIdSchema, userId);
}
