import { productStatuses, type ProductStatus } from '@/productStatus';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@/pagination';
import { isUuid, UUID_EXAMPLE } from '@/ids';
import type { RequestFieldValue } from '@/types/request';
import { z } from 'zod';
import {
  firstDefined,
  hasRequestValue,
  parseAppSchema,
  requestString,
} from '@/validators/parseSchema';

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

export type UpdateProductRequestBody = Partial<CreateProductRequestBody>;

export type ProductFilterQuery = {
  q?: RequestFieldValue;
  search?: RequestFieldValue;
  category?: RequestFieldValue;
  subcategory?: RequestFieldValue;
  seller?: RequestFieldValue;
  status?: RequestFieldValue;
  availability?: RequestFieldValue;
  sort?: RequestFieldValue;
  limit?: RequestFieldValue;
  offset?: RequestFieldValue;
};

function isProductStatus(status: string): status is ProductStatus {
  return productStatuses.includes(status as ProductStatus);
}

function isAllowedImageUrl(value: string) {
  if (!value || value.includes('\\')) return false;
  if (!value.includes(':') && !value.startsWith('//')) return true;

  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    const allowedHosts = new Set(
      (process.env.PRODUCT_IMAGE_HOSTS || 'example.com,images.unsplash.com')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean),
    );
    const localHttp =
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    return (
      (url.protocol === 'https:' || localHttp) &&
      (localHttp || allowedHosts.has(url.hostname.toLowerCase()))
    );
  } catch {
    return false;
  }
}

const imageUrlSchema = z
  .string()
  .trim()
  .refine(isAllowedImageUrl, {
    message: 'Product image must use an allowed HTTPS host or a relative path',
    params: { appCode: 'INVALID_PRODUCT_IMAGE_URL', statusCode: 400 },
  });

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
  .refine(
    (product) => product.status !== 'sold_out' || product.inventory === 0,
    {
      message: 'Sold-out products must have zero inventory',
      params: { appCode: 'INVALID_PRODUCT_STATUS_INVENTORY', statusCode: 400 },
    },
  )
  .refine((product) => !product.image || isAllowedImageUrl(product.image), {
    message: 'Product image must use an allowed HTTPS host or a relative path',
    params: { appCode: 'INVALID_PRODUCT_IMAGE_URL', statusCode: 400 },
  })
  .transform(({ hasInventory, ...product }) => ({
    ...product,
    status: (product.status === 'active' && product.inventory === 0
      ? 'sold_out'
      : product.status) as ProductStatus,
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

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    category: z
      .string()
      .trim()
      .min(1)
      .transform((value) => value.toLowerCase())
      .optional(),
    subcategory: z
      .string()
      .trim()
      .transform((value) => value.toLowerCase())
      .optional(),
    image: imageUrlSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one editable product field is required',
    params: { appCode: 'MISSING_PRODUCT_UPDATE_FIELDS', statusCode: 400 },
  })
  .meta({ id: 'UpdateProductRequest' });

export const productStatusUpdateSchema = z.object({
  status: z.enum(productStatuses),
});

export const productInventoryUpdateSchema = z.object({
  inventory: z.coerce.number().int().min(0),
});

export type UpdateProductData = z.infer<typeof updateProductSchema>;
export type ProductStatusUpdateData = z.infer<typeof productStatusUpdateSchema>;
export type ProductInventoryUpdateData = z.infer<
  typeof productInventoryUpdateSchema
>;

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
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_LIMIT)
      .default(DEFAULT_PAGE_LIMIT),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .transform((query) => ({
    q: requestString(query.q || query.search).trim(),
    category: requestString(query.category).trim().toLowerCase(),
    subcategory: requestString(query.subcategory).trim().toLowerCase(),
    seller: requestString(query.seller).trim(),
    status: requestString(query.status).trim(),
    availability: requestString(query.availability).trim(),
    sort: requestString(query.sort, 'created_desc').trim(),
    limit: query.limit,
    offset: query.offset,
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
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_PAGE_LIMIT,
          default: DEFAULT_PAGE_LIMIT,
        },
        offset: { type: 'integer', minimum: 0, default: 0 },
      },
    },
  });

export type ProductListFilters = z.infer<typeof productFiltersSchema>;

export const productIdSchema = z
  .unknown()
  .transform((value) => requestString(value).trim().toLowerCase())
  .refine((id) => isUuid(id), {
    message: 'Invalid product id',
    params: { appCode: 'INVALID_PRODUCT_ID', statusCode: 400 },
  })
  .meta({
    id: 'ProductId',
    example: UUID_EXAMPLE,
    override: { type: 'string', format: 'uuid' },
  });

export const sellerIdSchema = z
  .string()
  .transform((id) => id.trim().toLowerCase())
  .refine((id) => isUuid(id), {
    message: 'Invalid seller id',
    params: { appCode: 'INVALID_SELLER_ID', statusCode: 400 },
  })
  .meta({
    id: 'SellerId',
    example: UUID_EXAMPLE,
    override: { type: 'string', format: 'uuid' },
  });

export function validateCreateProductPayload(
  body: CreateProductRequestBody = {},
): CreateProductData {
  return parseAppSchema(createProductSchema, body);
}

export const validateUpdateProductPayload = (body: object) =>
  parseAppSchema(updateProductSchema, body);
export const validateProductStatusUpdate = (body: object) =>
  parseAppSchema(productStatusUpdateSchema, body);
export const validateProductInventoryUpdate = (body: object) =>
  parseAppSchema(productInventoryUpdateSchema, body);

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
