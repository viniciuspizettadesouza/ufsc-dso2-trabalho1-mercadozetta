import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/serverState/queryKeys';
import {
  getCart,
  putCartItem,
  removeCartItem,
  type CartItem,
  type CartItemInput,
} from '@/services/cart';

export type { CartItem } from '@/services/cart';
type CartMutationContext = {
  previousItems: CartItem[] | undefined;
  previousProductIds: string[] | undefined;
};

const noItems: CartItem[] = [];

export function useCartItems(userId: string, enabled = true) {
  const itemsKey = queryKeys.cart.items(userId);
  const query = useQuery({
    queryKey: itemsKey,
    enabled,
    queryFn: async () => (await getCart()).items,
  });

  return {
    items: query.data ?? noItems,
    isPending: query.isPending,
    isLoadError: query.isError && query.data === undefined,
  };
}

export function useDetailedCart(userId: string) {
  const queryClient = useQueryClient();
  const itemsKey = queryKeys.cart.items(userId);
  const productIdsKey = queryKeys.cart.productIds(userId);
  const query = useCartItems(userId);
  const updateQuantity = useMutation<
    CartItem[],
    Error,
    CartItemInput,
    CartMutationContext
  >({
    mutationFn: async (input) => (await putCartItem(input)).items,
    onMutate: async ({ productId, quantity }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: itemsKey }),
        queryClient.cancelQueries({ queryKey: productIdsKey }),
      ]);
      const context = cartMutationContext(queryClient, itemsKey, productIdsKey);
      queryClient.setQueryData<CartItem[]>(itemsKey, (current = noItems) =>
        current.map((item) =>
          item.product._id === productId ? { ...item, quantity } : item,
        ),
      );
      return context;
    },
    onError: (_error, _variables, context) => {
      restoreCartContext(queryClient, itemsKey, productIdsKey, context);
    },
    onSuccess: (items) => {
      synchronizeCart(queryClient, itemsKey, productIdsKey, items);
    },
  });
  const removeItem = useMutation<
    CartItem[],
    Error,
    string,
    CartMutationContext
  >({
    mutationFn: async (productId) => (await removeCartItem(productId)).items,
    onMutate: async (productId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: itemsKey }),
        queryClient.cancelQueries({ queryKey: productIdsKey }),
      ]);
      const context = cartMutationContext(queryClient, itemsKey, productIdsKey);
      queryClient.setQueryData<CartItem[]>(itemsKey, (current = noItems) =>
        current.filter((item) => item.product._id !== productId),
      );
      queryClient.setQueryData<string[]>(productIdsKey, (current = []) =>
        current.filter((id) => id !== productId),
      );
      return context;
    },
    onError: (_error, _variables, context) => {
      restoreCartContext(queryClient, itemsKey, productIdsKey, context);
    },
    onSuccess: (items) => {
      synchronizeCart(queryClient, itemsKey, productIdsKey, items);
    },
  });

  return {
    items: query.items,
    isPending: query.isPending,
    isLoadError: query.isLoadError,
    updateQuantity: updateQuantity.mutateAsync,
    removeItem: removeItem.mutateAsync,
  };
}

function cartMutationContext(
  queryClient: ReturnType<typeof useQueryClient>,
  itemsKey: ReturnType<typeof queryKeys.cart.items>,
  productIdsKey: ReturnType<typeof queryKeys.cart.productIds>,
): CartMutationContext {
  return {
    previousItems: queryClient.getQueryData<CartItem[]>(itemsKey),
    previousProductIds: queryClient.getQueryData<string[]>(productIdsKey),
  };
}

function restoreCartContext(
  queryClient: ReturnType<typeof useQueryClient>,
  itemsKey: ReturnType<typeof queryKeys.cart.items>,
  productIdsKey: ReturnType<typeof queryKeys.cart.productIds>,
  context: CartMutationContext | undefined,
) {
  restoreQuery(queryClient, itemsKey, context?.previousItems);
  restoreQuery(queryClient, productIdsKey, context?.previousProductIds);
}

function restoreQuery<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  previous: T | undefined,
) {
  if (previous === undefined) {
    queryClient.removeQueries({ queryKey, exact: true });
  } else {
    queryClient.setQueryData(queryKey, previous);
  }
}

function synchronizeCart(
  queryClient: ReturnType<typeof useQueryClient>,
  itemsKey: ReturnType<typeof queryKeys.cart.items>,
  productIdsKey: ReturnType<typeof queryKeys.cart.productIds>,
  items: CartItem[],
) {
  queryClient.setQueryData(itemsKey, items);
  queryClient.setQueryData(
    productIdsKey,
    items.map(({ product }) => product._id),
  );
}
