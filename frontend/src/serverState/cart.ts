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

export function useDetailedCart(userId: string) {
  const queryClient = useQueryClient();
  const itemsKey = queryKeys.cart.items(userId);
  const productIdsKey = queryKeys.cart.productIds(userId);
  const query = useQuery({
    queryKey: itemsKey,
    queryFn: async () => (await getCart()).items,
  });
  const updateQuantity = useMutation<
    void,
    Error,
    CartItemInput,
    CartMutationContext
  >({
    mutationFn: async (input) => void (await putCartItem(input)),
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
    onSuccess: () => {
      invalidateCart(queryClient, itemsKey, productIdsKey);
    },
  });
  const removeItem = useMutation<void, Error, string, CartMutationContext>({
    mutationFn: async (productId) => void (await removeCartItem(productId)),
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
    onSuccess: () => {
      invalidateCart(queryClient, itemsKey, productIdsKey);
    },
  });

  return {
    items: query.data ?? noItems,
    isPending: query.isPending,
    isLoadError: query.isError && query.data === undefined,
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

function invalidateCart(
  queryClient: ReturnType<typeof useQueryClient>,
  itemsKey: ReturnType<typeof queryKeys.cart.items>,
  productIdsKey: ReturnType<typeof queryKeys.cart.productIds>,
) {
  void queryClient.invalidateQueries({
    queryKey: itemsKey,
    refetchType: 'inactive',
  });
  void queryClient.invalidateQueries({
    queryKey: productIdsKey,
    refetchType: 'inactive',
  });
}
