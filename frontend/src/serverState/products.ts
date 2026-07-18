import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { pageInfo, pageItems } from '@/pagination';
import { apiRoutes } from '@/routes';
import api from '@/services/api';
import { queryKeys, type ProductListRequest } from '@/serverState/queryKeys';

export type ProductStatus =
  'draft' | 'active' | 'paused' | 'sold_out' | 'archived';
export type Product = {
  _id: string;
  name: string;
  description: string;
  image: string;
  category?: string;
  subcategory?: string;
  inventory?: number;
  status?: ProductStatus;
  seller?: string;
  createdAt?: string;
  sellerProfile?: {
    _id?: string;
    username?: string;
    telephone?: string;
    email?: string;
    storeName?: string;
  };
};

export const productQueries = {
  list: (request: ProductListRequest) =>
    queryOptions({
      queryKey: queryKeys.products.list(request),
      queryFn: async () => {
        const response = await api.get(productListPath(request));
        return {
          items: pageItems<Product>(response.data),
          page: pageInfo<Product>(response.data),
        };
      },
    }),
  detail: (productId: string) =>
    queryOptions({
      queryKey: queryKeys.products.detail(productId),
      queryFn: async () => {
        const response = await api.get(apiRoutes.productDetail(productId));
        return response.data as Product;
      },
    }),
};

export function useProductList(
  request: ProductListRequest,
  enabled: boolean = true,
) {
  return useQuery({
    ...productQueries.list(request),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useProductDetail(productId: string, enabled: boolean) {
  return useQuery({
    ...productQueries.detail(productId),
    enabled,
  });
}

export type ProductDetailsUpdate = Pick<
  Product,
  'name' | 'description' | 'category' | 'subcategory' | 'image'
>;
export type CreateProductInput = ProductDetailsUpdate & {
  inventory: number;
  status: ProductStatus;
};

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const response = await api.post(apiRoutes.products, input);
      return response.data.newProduct as Product;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      });
    },
  });
}

export function useUpdateProductDetails(productId: string) {
  return useProductMutation<ProductDetailsUpdate>(
    productId,
    apiRoutes.productDetail(productId),
  );
}

export function useUpdateProductInventory(productId: string) {
  return useProductMutation<{ inventory: number }>(
    productId,
    apiRoutes.productInventory(productId),
  );
}

export function useUpdateProductStatus(productId: string) {
  return useProductMutation<{ status: ProductStatus }>(
    productId,
    apiRoutes.productStatus(productId),
  );
}

function useProductMutation<TVariables>(productId: string, path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: TVariables) => {
      const response = await api.patch(path, body);
      return response.data as Product;
    },
    onSuccess: (product) => {
      queryClient.setQueryData(queryKeys.products.detail(productId), product);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      });
    },
  });
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
