import mongoose from 'mongoose';
import AppError from '../errors/AppError';
import { productStatuses, type ProductStatus } from '../productStatus';

function isProductStatus(status: string): status is ProductStatus {
  return productStatuses.includes(status as ProductStatus);
}

export function validateCreateProductPayload(body: Record<string, unknown> = {}) {
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();
  const category = String(body.category || 'general').trim().toLowerCase();
  const subcategory = String(body.subcategory || '').trim().toLowerCase();
  const rawInventory = body.inventory ?? body.quant;
  const image = String(body.image || '').trim();
  const inventory = Number(rawInventory);
  const status = body.status === undefined || body.status === null || body.status === ''
    ? 'active'
    : String(body.status).trim();

  if (!name || rawInventory === undefined || rawInventory === null || rawInventory === '' || !image)
    throw new AppError(400, 'MISSING_PRODUCT_FIELDS', 'Name, quantity and image are required');

  if (!Number.isInteger(inventory) || inventory < 0)
    throw new AppError(400, 'INVALID_PRODUCT_INVENTORY', 'Quantity must be a non-negative integer');

  if (!isProductStatus(status))
    throw new AppError(400, 'INVALID_PRODUCT_STATUS', 'Product status must be draft, active, paused, sold_out, or archived');

  return {
    name,
    description,
    category,
    subcategory,
    inventory,
    image,
    status,
  };
}

export function validateProductFilters(query: Record<string, unknown> = {}) {
  const sortModes = ['created_asc', 'created_desc', 'name_asc', 'inventory_desc'];
  const availabilityModes = ['in_stock', 'sold_out'];
  const filters = {
    q: String(query.q || query.search || '').trim(),
    category: String(query.category || '').trim().toLowerCase(),
    subcategory: String(query.subcategory || '').trim().toLowerCase(),
    seller: String(query.seller || '').trim(),
    status: String(query.status || '').trim(),
    availability: String(query.availability || '').trim(),
    sort: String(query.sort || 'created_desc').trim(),
  };

  if (filters.status && !isProductStatus(filters.status))
    throw new AppError(400, 'INVALID_PRODUCT_STATUS_FILTER', 'Product status filter must be draft, active, paused, sold_out, or archived');

  if (filters.availability && !availabilityModes.includes(filters.availability))
    throw new AppError(400, 'INVALID_PRODUCT_AVAILABILITY_FILTER', 'Product availability filter must be in_stock or sold_out');

  if (!sortModes.includes(filters.sort))
    throw new AppError(400, 'INVALID_PRODUCT_SORT', 'Product sort must be created_asc, created_desc, name_asc, or inventory_desc');

  return filters;
}

export function validateProductId(productId: unknown) {
  const id = String(productId || '').trim();

  if (!id)
    throw new AppError(400, 'INVALID_PRODUCT_ID', 'Invalid product id');

  return id;
}

export function validateSellerId(userId: string) {
  if (!mongoose.Types.ObjectId.isValid(userId))
    throw new AppError(400, 'INVALID_SELLER_ID', 'Invalid seller id');

  return userId;
}
