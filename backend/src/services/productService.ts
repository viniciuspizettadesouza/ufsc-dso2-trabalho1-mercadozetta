import type { ProductRepository } from '@/repositories/productRepository';
import { defaultTenantId } from '@/tenants';
import {
  type CreateProductData,
  type CreateProductRequestBody,
  type ProductFilterQuery,
  type ProductListFilters,
  type UpdateProductData,
  type ProductStatusUpdateData,
  type ProductInventoryUpdateData,
  validateCreateProductPayload,
  validateProductFilters,
  validateProductId,
  validateSellerId,
  validateUpdateProductPayload,
  validateProductStatusUpdate,
  validateProductInventoryUpdate,
} from '@/validators/productValidator';
import AppError from '@/errors/AppError';

type SellerProfileService = {
  getPublicSellerProfile(
    userId: string,
    tenantId?: string,
  ): Promise<Record<string, unknown>>;
};

export function createProductService(
  repository: ProductRepository,
  userService: SellerProfileService,
) {
  async function ownedProduct(
    productId: string,
    seller: string,
    tenantId: string,
  ) {
    const id = validateProductId(productId);
    const product = await repository.findById(tenantId, id);
    if (!product)
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    if (product.seller !== seller)
      throw new AppError(
        403,
        'PRODUCT_FORBIDDEN',
        'Not authorized to manage this product',
      );
    return product;
  }
  async function listProducts(
    tenantId = defaultTenantId,
    filters: ProductFilterQuery | ProductListFilters = {},
  ) {
    const validatedFilters = validateProductFilters(filters);
    return repository.list(tenantId, validatedFilters);
  }

  async function createProduct(
    body: CreateProductRequestBody | CreateProductData,
    seller: string,
    tenantId = defaultTenantId,
  ) {
    const productData = validateCreateProductPayload(body);
    return repository.create({ ...productData, tenantId, seller });
  }

  async function getProductById(productId: string, tenantId = defaultTenantId) {
    const _id = validateProductId(productId);
    const product = await repository.findById(tenantId, _id);

    if (!product) return null;

    try {
      const seller = await userService.getPublicSellerProfile(
        String(product.seller),
        tenantId,
      );
      return { ...product, sellerProfile: seller };
    } catch {
      return product;
    }
  }

  async function listProductsBySeller(
    userId: string,
    tenantId = defaultTenantId,
    filters: ProductFilterQuery | ProductListFilters = {},
  ) {
    const seller = validateSellerId(userId);
    const validatedFilters = validateProductFilters(filters);
    return repository.list(tenantId, {
      ...validatedFilters,
      seller,
    });
  }

  async function updateProduct(
    productId: string,
    body: UpdateProductData | Record<string, unknown>,
    seller: string,
    tenantId = defaultTenantId,
  ) {
    await ownedProduct(productId, seller, tenantId);
    const update = validateUpdateProductPayload(body);
    return repository.updateOwned(tenantId, productId, seller, update);
  }

  async function updateProductStatus(
    productId: string,
    body: ProductStatusUpdateData | Record<string, unknown>,
    seller: string,
    tenantId = defaultTenantId,
  ) {
    const product = await ownedProduct(productId, seller, tenantId);
    const { status } = validateProductStatusUpdate(body);
    if (status === 'sold_out')
      throw new AppError(
        409,
        'PRODUCT_STATUS_TRANSITION_INVALID',
        'Sold-out status is managed by inventory',
      );
    if (status === 'active' && product.inventory < 1)
      throw new AppError(
        409,
        'PRODUCT_INVENTORY_REQUIRED',
        'Active products require inventory',
      );
    const allowed: Record<string, string[]> = {
      draft: ['active', 'archived'],
      active: ['paused', 'archived'],
      paused: ['active', 'archived'],
      sold_out: ['active', 'archived'],
      archived: ['active'],
    };
    if (
      status !== product.status &&
      !allowed[product.status || 'active']?.includes(status)
    )
      throw new AppError(
        409,
        'PRODUCT_STATUS_TRANSITION_INVALID',
        `Product cannot transition from ${product.status || 'active'} to ${status}`,
      );
    return repository.updateOwned(tenantId, productId, seller, { status });
  }

  async function updateProductInventory(
    productId: string,
    body: ProductInventoryUpdateData | Record<string, unknown>,
    seller: string,
    tenantId = defaultTenantId,
  ) {
    const product = await ownedProduct(productId, seller, tenantId);
    const { inventory } = validateProductInventoryUpdate(body);
    const status =
      inventory === 0 && product.status === 'active'
        ? 'sold_out'
        : inventory > 0 && product.status === 'sold_out'
          ? 'active'
          : product.status;
    return repository.updateOwned(tenantId, productId, seller, {
      inventory,
      ...(status === product.status || !status ? {} : { status }),
    });
  }

  return {
    listProducts,
    createProduct,
    getProductById,
    listProductsBySeller,
    updateProduct,
    updateProductStatus,
    updateProductInventory,
  };
}

export type ProductService = ReturnType<typeof createProductService>;
