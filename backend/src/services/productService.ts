import type {
  ProductRecord,
  ProductRepository,
} from '@/repositories/productRepository';
import { defaultTenantId } from '@/tenants';
import {
  type CreateProductData,
  type CreateProductRequestBody,
  type ProductFilterQuery,
  type ProductListFilters,
  validateCreateProductPayload,
  validateProductFilters,
  validateProductId,
  validateSellerId,
} from '@/validators/productValidator';

type ProductListItem = Pick<
  ProductRecord,
  | 'name'
  | 'description'
  | 'category'
  | 'subcategory'
  | 'status'
  | 'seller'
  | 'inventory'
> & {
  createdAt?: string | number | Date;
};

function normalizeText(value: string | number | boolean | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function toTimestamp(value?: string | number | Date) {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    value instanceof Date
  )
    return new Date(value).getTime();

  return 0;
}

function filterProducts<T extends ProductListItem>(
  products: T[],
  filters: ProductListFilters,
) {
  const q = normalizeText(filters.q);
  const category = normalizeText(filters.category);
  const subcategory = normalizeText(filters.subcategory);
  const seller = String(filters.seller || '').trim();
  const status = normalizeText(filters.status);
  const availability = normalizeText(filters.availability);

  return products.filter((product) => {
    const productName = normalizeText(product.name);
    const description = normalizeText(product.description);
    const productCategory = normalizeText(product.category);
    const productSubcategory = normalizeText(product.subcategory);
    const productStatus = normalizeText(product.status || 'active');
    const productSeller = String(product.seller || '');
    const inventory = Number(product.inventory || 0);

    return (
      (!q || productName.includes(q) || description.includes(q)) &&
      (!category || productCategory === category) &&
      (!subcategory || productSubcategory === subcategory) &&
      (!seller || productSeller === seller) &&
      (!status || productStatus === status) &&
      (!availability ||
        (availability === 'in_stock' && inventory > 0) ||
        (availability === 'sold_out' && inventory === 0))
    );
  });
}

function sortProducts<T extends ProductListItem>(products: T[], sort?: string) {
  const sortedProducts = [...products];

  switch (sort) {
    case 'created_asc':
      return sortedProducts.sort(
        (a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt),
      );
    case 'name_asc':
      return sortedProducts.sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || '')),
      );
    case 'inventory_desc':
      return sortedProducts.sort(
        (a, b) => Number(b.inventory || 0) - Number(a.inventory || 0),
      );
    case 'created_desc':
    default:
      return sortedProducts.sort(
        (a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt),
      );
  }
}

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
  async function listProducts(
    tenantId = defaultTenantId,
    filters: ProductFilterQuery | ProductListFilters = {},
  ) {
    const validatedFilters = validateProductFilters(filters);
    const products = await repository.list(tenantId);
    return sortProducts(
      filterProducts(products, validatedFilters),
      String(validatedFilters.sort || 'created_desc'),
    );
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
    const products = await repository.list(tenantId, seller);
    return sortProducts(
      filterProducts(products, validatedFilters),
      String(validatedFilters.sort || 'created_desc'),
    );
  }

  return {
    listProducts,
    createProduct,
    getProductById,
    listProductsBySeller,
  };
}

export type ProductService = ReturnType<typeof createProductService>;
