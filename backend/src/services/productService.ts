import type { ProductRepository } from '@/repositories/productRepository';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import { defaultTenantId, resolveTenant } from '@/tenants';
import { sameMoney, type Money } from '@/money';
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
import {
  idempotencyKeyConflict,
  mutationRequestHash,
} from '@/services/mutationIdempotencyService';

type SellerProfileService = {
  getPublicSellerProfile(
    userId: string,
    tenantId?: string,
  ): Promise<Record<string, unknown>>;
};

export function createProductService(
  repository: ProductRepository,
  userService: SellerProfileService,
  transactions: CheckoutTransactionCoordinator,
) {
  async function ownedProductWithRepository(
    productRepository: ProductRepository,
    productId: string,
    seller: string,
    tenantId: string,
  ) {
    const id = validateProductId(productId);
    const product = await productRepository.findById(tenantId, id);
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
  const ownedProduct = (productId: string, seller: string, tenantId: string) =>
    ownedProductWithRepository(repository, productId, seller, tenantId);
  function requireTenantCurrency(price: Money, tenantId: string) {
    const tenant = resolveTenant(tenantId);
    if (!tenant || price.currency !== tenant.currencyCode)
      throw new AppError(
        400,
        'INVALID_PRODUCT_CURRENCY',
        'Product price currency must match the tenant currency',
      );
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
    idempotencyKey: string,
  ) {
    const productData = validateCreateProductPayload(body);
    requireTenantCurrency(productData.price, tenantId);
    const requestHash = mutationRequestHash(productData);
    return transactions.run(async ({ idempotency, products }) => {
      const claim = await idempotency.claim({
        tenantId,
        actorId: seller,
        operation: 'product.create',
        key: idempotencyKey,
        requestHash,
        now: new Date(),
      });
      if (claim.outcome === 'conflict') throw idempotencyKeyConflict();
      if (claim.outcome === 'replay') {
        const replay = await products.findById(tenantId, claim.resourceId);
        if (!replay) throw new Error('Idempotent product resource is missing');
        return replay;
      }

      const created = await products.create({
        ...productData,
        tenantId,
        seller,
      });
      await products.appendPriceHistory({
        tenantId,
        productId: created._id,
        actorId: seller,
        price: productData.price,
        changedAt: new Date(),
      });
      await idempotency.complete({
        tenantId,
        actorId: seller,
        operation: 'product.create',
        key: idempotencyKey,
        requestHash,
        resourceId: created._id,
      });
      return created;
    });
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
    const id = validateProductId(productId);
    const update = validateUpdateProductPayload(body);
    if (update.price) requireTenantCurrency(update.price, tenantId);
    return transactions.run(async ({ products }) => {
      const product = await products.findByIdForUpdate(tenantId, id);
      if (!product)
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
      if (product.seller !== seller)
        throw new AppError(
          403,
          'PRODUCT_FORBIDDEN',
          'Not authorized to manage this product',
        );

      const priceChanged =
        update.price !== undefined && !sameMoney(product.price, update.price);
      const { price: requestedPrice, ...otherUpdates } = update;
      const effectiveUpdate = priceChanged
        ? { ...otherUpdates, price: requestedPrice }
        : otherUpdates;
      if (!Object.values(effectiveUpdate).some((value) => value !== undefined))
        return product;

      const updated = await products.updateOwned(
        tenantId,
        id,
        seller,
        effectiveUpdate,
      );
      if (priceChanged) {
        await products.appendPriceHistory({
          tenantId,
          productId: id,
          actorId: seller,
          price: update.price!,
          changedAt: new Date(),
        });
      }
      return updated;
    });
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
    if (status === 'active' && !product.price)
      throw new AppError(
        409,
        'PRODUCT_PRICE_REQUIRED',
        'Active products require a price',
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
    return transactions.run(async ({ products, audits }) => {
      const product = await ownedProductWithRepository(
        products,
        productId,
        seller,
        tenantId,
      );
      const { inventory } = validateProductInventoryUpdate(body);
      if (inventory === product.inventory) return product;
      const status =
        inventory === 0 && product.status === 'active'
          ? 'sold_out'
          : inventory > 0 && product.status === 'sold_out'
            ? 'active'
            : product.status;
      const updated = await products.updateOwned(tenantId, productId, seller, {
        inventory,
        ...(status === product.status || !status ? {} : { status }),
      });
      await audits.append({
        tenantId,
        eventType: 'inventory.set',
        actorId: seller,
        resourceType: 'product',
        resourceId: productId,
        metadata: {
          previousInventory: product.inventory,
          nextInventory: inventory,
          previousStatus: product.status || 'active',
          nextStatus: status || 'active',
        },
        occurredAt: new Date(),
      });
      return updated;
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
