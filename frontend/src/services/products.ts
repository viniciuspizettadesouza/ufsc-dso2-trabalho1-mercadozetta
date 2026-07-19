import type { components, paths } from '@/contracts/api';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type Product = components['schemas']['Product'];
export type ProductStatus = Product['status'];
export type ProductListResponse =
  paths['/products']['get']['responses'][200]['content']['application/json'];
export type ProductListRequest = {
  sellerId: string | null;
  q: string;
  category: string;
  availability: string;
  sort: string;
  limit: number | null;
  offset: number | null;
};
export type ProductDetailsUpdate = Required<
  components['schemas']['UpdateProductRequest']
>;
export type CreateProductInput = ProductDetailsUpdate & {
  inventory: number;
  status: ProductStatus;
};
export type CreateProductMutation = CreateProductInput & {
  idempotencyKey: string;
};
export type ProductInventoryUpdate = { inventory: number };
export type ProductStatusUpdate = { status: ProductStatus };

export async function listProducts(request: ProductListRequest) {
  const response = await api.get<ProductListResponse>(productListPath(request));
  return response.data;
}

export async function getProduct(productId: string) {
  const response = await api.get<Product>(apiRoutes.productDetail(productId));
  return response.data;
}

export async function createProduct(input: CreateProductMutation) {
  const { idempotencyKey, ...body } = input;
  const response = await api.post<Product>(apiRoutes.products, body, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data;
}

export async function updateProductDetails(
  productId: string,
  input: ProductDetailsUpdate,
) {
  return updateProduct(apiRoutes.productDetail(productId), input);
}

export async function updateProductInventory(
  productId: string,
  input: ProductInventoryUpdate,
) {
  return updateProduct(apiRoutes.productInventory(productId), input);
}

export async function updateProductStatus(
  productId: string,
  input: ProductStatusUpdate,
) {
  return updateProduct(apiRoutes.productStatus(productId), input);
}

async function updateProduct<TInput>(path: string, input: TInput) {
  const response = await api.patch<Product>(path, input);
  return response.data;
}

function productListPath(request: ProductListRequest) {
  const basePath = request.sellerId
    ? apiRoutes.sellerProducts(request.sellerId)
    : apiRoutes.products;
  const params = new URLSearchParams();

  if (request.q) params.set('q', request.q);
  if (request.category) params.set('category', request.category);
  if (request.availability) {
    params.set('availability', request.availability);
  }
  if (request.sort) params.set('sort', request.sort);
  if (request.limit !== null) params.set('limit', String(request.limit));
  if (request.offset !== null) params.set('offset', String(request.offset));

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
