import Product from '../model/product';
import { defaultTenantId } from '../tenants';
import UserService from './userService';
import {
  validateCreateProductPayload,
  validateProductId,
  validateSellerId,
} from '../validators/productValidator';
import type { ProductStatus } from '../productStatus';

function normalizeText(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function filterProducts(products: any[], filters: Record<string, unknown> = {}) {
  const q = normalizeText(filters.q || filters.search);
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

function sortProducts(products: any[], sort?: string) {
  const sortedProducts = [...products];

  switch (sort) {
    case 'created_asc':
      return sortedProducts.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    case 'name_asc':
      return sortedProducts.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    case 'inventory_desc':
      return sortedProducts.sort((a, b) => Number(b.inventory || 0) - Number(a.inventory || 0));
    case 'created_desc':
    default:
      return sortedProducts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }
}

export async function listProducts(tenantId = defaultTenantId, filters: Record<string, unknown> = {}) {
  const products = await Product.find({ tenantId });
  return sortProducts(filterProducts(products, filters), String(filters.sort || 'created_desc'));
}

export async function createProduct(body: Record<string, unknown>, seller: string, tenantId = defaultTenantId) {
  const payload = validateCreateProductPayload(body) as {
    name: string;
    description: string;
    category: string;
    subcategory: string;
    inventory: number;
    image: string;
    status: ProductStatus;
  };

  return Product.create({
    ...payload,
    tenantId,
    seller,
  });
}

export async function getProductById(productId: string, tenantId = defaultTenantId) {
  const _id = validateProductId(productId);
  const product = await Product.findOne({ _id, tenantId });

  if (!product)
    return null;

  try {
    const seller = await UserService.getPublicSellerProfile(String(product.seller), tenantId);
    return { ...product.toObject(), sellerProfile: seller };
  } catch {
    return product;
  }
}

export async function listProductsBySeller(userId: string, tenantId = defaultTenantId, filters: Record<string, unknown> = {}) {
  const seller = validateSellerId(userId);
  const products = await Product.find({ tenantId, seller });
  return sortProducts(filterProducts(products, filters), String(filters.sort || 'created_desc'));
}

const ProductService = {
  listProducts,
  createProduct,
  getProductById,
  listProductsBySeller,
};

export default ProductService;
