import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  createProduct,
  getProduct,
  listProducts,
  updateProductDetails,
  updateProductInventory,
  updateProductStatus,
  type CreateProductInput,
  type Product,
  type ProductDetailsUpdate,
  type ProductInventoryUpdate,
  type ProductListRequest,
  type ProductStatus,
  type ProductStatusUpdate,
} from '@/services/products';
import { queryKeys } from '@/serverState/queryKeys';

export type {
  CreateProductInput,
  Product,
  ProductDetailsUpdate,
  ProductStatus,
};

export const productQueries = {
  list: (request: ProductListRequest) =>
    queryOptions({
      queryKey: queryKeys.products.list(request),
      queryFn: () => listProducts(request),
    }),
  detail: (productId: string) =>
    queryOptions({
      queryKey: queryKeys.products.detail(productId),
      queryFn: () => getProduct(productId),
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

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      });
    },
  });
}

export function useUpdateProductDetails(productId: string) {
  return useProductMutation<ProductDetailsUpdate>(productId, (input) =>
    updateProductDetails(productId, input),
  );
}

export function useUpdateProductInventory(productId: string) {
  return useProductMutation<ProductInventoryUpdate>(productId, (input) =>
    updateProductInventory(productId, input),
  );
}

export function useUpdateProductStatus(productId: string) {
  return useProductMutation<ProductStatusUpdate>(productId, (input) =>
    updateProductStatus(productId, input),
  );
}

function useProductMutation<TVariables>(
  productId: string,
  mutation: (body: TVariables) => Promise<Product>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutation,
    onSuccess: (product) => {
      queryClient.setQueryData(queryKeys.products.detail(productId), product);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      });
    },
  });
}
