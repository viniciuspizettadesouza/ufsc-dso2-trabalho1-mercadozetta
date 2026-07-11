import { z } from 'zod';
import { createDocument } from 'zod-openapi';
import { loginSchema } from '../validators/authValidator';
import {
  createProductSchema,
  productFiltersSchema,
  productIdSchema,
  sellerIdSchema,
} from '../validators/productValidator';
import { createUserSchema } from '../validators/userValidator';

const tenantHeader = z.string().optional().meta({
  param: { name: 'X-Tenant-Id', in: 'header' },
  description: 'Tenant slug. Required when TENANT_HEADER_REQUIRED is enabled; defaults to mercadozetta otherwise.',
  example: 'mercadozetta',
});

const objectId = z.string().meta({ example: '507f1f77bcf86cd799439011' });
const timestamp = z.iso.datetime().optional();
const productStatus = z.enum(['draft', 'active', 'paused', 'sold_out', 'archived']);

const userSchema = z.object({
  _id: objectId,
  tenantId: z.string(),
  email: z.email(),
  username: z.string(),
  telephone: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).meta({ id: 'User' });

const sellerProfileSchema = z.object({
  _id: objectId,
  username: z.string(),
  telephone: z.string(),
  email: z.email(),
  storeName: z.string(),
}).meta({ id: 'SellerProfile' });

const productSchema = z.object({
  _id: objectId,
  tenantId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  inventory: z.int().min(0),
  image: z.string(),
  status: productStatus,
  seller: z.union([objectId, sellerProfileSchema]),
  createdAt: timestamp,
  updatedAt: timestamp,
}).meta({ id: 'Product' });

const errorSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.unknown().optional(),
}).meta({ id: 'Error' });

const welcomeSchema = z.object({ message: z.string() }).meta({ id: 'Welcome' });
const healthSchema = z.object({ status: z.literal('ok') }).meta({ id: 'Health' });
const readinessSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.object({ mongodb: z.enum(['connected', 'disconnected']) }),
}).meta({ id: 'Readiness' });

const productExample = {
  _id: '507f191e810c19729de860ea',
  tenantId: 'mercadozetta',
  name: 'mechanical keyboard',
  description: 'Compact keyboard',
  category: 'electronics',
  subcategory: 'keyboards',
  inventory: 5,
  image: 'https://example.com/keyboard.jpg',
  status: 'active',
  seller: '507f1f77bcf86cd799439011',
};

const userExample = {
  _id: '507f1f77bcf86cd799439011',
  tenantId: 'mercadozetta',
  email: 'seller@example.com',
  username: 'seller',
  telephone: '+55 48 99999-0000',
};

const json = (schema: z.ZodType, example?: unknown) => ({
  'application/json': { schema, ...(example === undefined ? {} : { example }) },
});

const badRequest = {
  description: 'Invalid input or tenant',
  content: json(errorSchema, { error: 'Invalid tenant', code: 'INVALID_TENANT' }),
};
const unauthorized = {
  description: 'Missing or invalid credentials/token',
  content: json(errorSchema, { error: 'Invalid authorization token', code: 'INVALID_AUTH_TOKEN' }),
};
const notFound = (resource: string) => ({
  description: `${resource} not found`,
  content: json(errorSchema, { error: `${resource} not found`, code: `${resource.toUpperCase()}_NOT_FOUND` }),
});

export function createOpenApiDocument() {
  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'MercadoZetta API',
      version: '1.0.0',
      description: 'HTTP contract for the current white-label marketplace API.',
    },
    servers: [{ url: 'http://localhost:3333', description: 'Local development' }],
    tags: [
      { name: 'System' },
      { name: 'Authentication' },
      { name: 'Users' },
      { name: 'Products' },
    ],
    paths: {
      '/': {
        get: {
          tags: ['System'],
          summary: 'Describe the API',
          responses: {
            200: {
              description: 'Welcome message',
              content: json(welcomeSchema, { message: 'Welcome to zetta2k app' }),
            },
          },
        },
      },
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Check process health',
          responses: {
            200: {
              description: 'The API process is healthy',
              content: json(healthSchema, { status: 'ok' }),
            },
          },
        },
      },
      '/ready': {
        get: {
          tags: ['System'],
          summary: 'Check database readiness',
          responses: {
            200: {
              description: 'The API is ready',
              content: json(readinessSchema, { status: 'ready', checks: { mongodb: 'connected' } }),
            },
            503: {
              description: 'MongoDB is unavailable',
              content: json(readinessSchema, { status: 'not_ready', checks: { mongodb: 'disconnected' } }),
            },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Log in',
          parameters: [tenantHeader],
          requestBody: {
            required: true,
            content: json(loginSchema, { email: 'seller@example.com', password: 'password123' }),
          },
          responses: {
            200: {
              description: 'Authenticated session',
              content: json(z.object({ user: userSchema, token: z.string() }), {
                user: userExample,
                token: 'eyJhbGciOiJIUzI1NiJ9.example',
              }),
            },
            400: badRequest,
            401: unauthorized,
            429: { description: 'Rate limit exceeded', content: json(errorSchema) },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Log out and invalidate existing access tokens',
          security: [{ bearerAuth: [] }],
          parameters: [tenantHeader],
          responses: { 204: { description: 'Logged out' }, 400: badRequest, 401: unauthorized },
        },
      },
      '/users': {
        post: {
          tags: ['Users'],
          summary: 'Create an account',
          parameters: [tenantHeader],
          requestBody: {
            required: true,
            content: json(createUserSchema, {
              email: 'seller@example.com',
              password: 'password123',
              username: 'seller',
              telephone: '+55 48 99999-0000',
            }),
          },
          responses: {
            201: {
              description: 'Account created',
              content: json(z.object({ newUser: userSchema }), { newUser: userExample }),
            },
            400: badRequest,
            429: { description: 'Rate limit exceeded', content: json(errorSchema) },
          },
        },
      },
      '/users/{userId}': {
        get: {
          tags: ['Users'],
          summary: 'Get a seller profile',
          parameters: [tenantHeader],
          requestParams: { path: z.object({ userId: sellerIdSchema }) },
          responses: {
            200: {
              description: 'Public seller profile',
              content: json(sellerProfileSchema, { ...userExample, storeName: 'seller store' }),
            },
            400: badRequest,
            404: notFound('Seller'),
          },
        },
      },
      '/users/{userId}/products': {
        get: {
          tags: ['Products'],
          summary: 'List products from one seller',
          parameters: [tenantHeader],
          requestParams: {
            path: z.object({ userId: sellerIdSchema }),
            query: productFiltersSchema,
          },
          responses: {
            200: { description: 'Products from the seller', content: json(z.array(productSchema), [productExample]) },
            400: badRequest,
          },
        },
      },
      '/products': {
        get: {
          tags: ['Products'],
          summary: 'Search and list products',
          parameters: [tenantHeader],
          requestParams: { query: productFiltersSchema },
          responses: {
            200: { description: 'Products in the current tenant', content: json(z.array(productSchema), [productExample]) },
            400: badRequest,
          },
        },
        post: {
          tags: ['Products'],
          summary: 'Create a product',
          security: [{ bearerAuth: [] }],
          parameters: [tenantHeader],
          requestBody: {
            required: true,
            content: json(createProductSchema, {
              name: 'Mechanical keyboard',
              description: 'Compact keyboard',
              category: 'electronics',
              subcategory: 'keyboards',
              inventory: 5,
              image: 'https://example.com/keyboard.jpg',
              status: 'active',
            }),
          },
          responses: {
            201: {
              description: 'Product created',
              content: json(z.object({ newProduct: productSchema }), { newProduct: productExample }),
            },
            400: badRequest,
            401: unauthorized,
          },
        },
      },
      '/products/{productId}': {
        get: {
          tags: ['Products'],
          summary: 'Get a product',
          parameters: [tenantHeader],
          requestParams: { path: z.object({ productId: productIdSchema }) },
          responses: {
            200: { description: 'Product detail', content: json(productSchema, productExample) },
            400: badRequest,
            404: notFound('Product'),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  });
}

export function serializeOpenApiDocument() {
  return `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`;
}
