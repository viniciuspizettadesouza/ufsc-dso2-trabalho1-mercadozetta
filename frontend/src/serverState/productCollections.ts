import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRoutes } from '@/routes';
import api from '@/services/api';
import { queryKeys } from '@/serverState/queryKeys';
import type { CartItem } from '@/serverState/cart';

type Collection = 'cart' | 'watchlist';
type CollectionEntry = { product: string | { _id: string } };
type ToggleVariables = { productId: string; remove: boolean };
type MutationContext = {
  previous: string[] | undefined;
  previousCartItems: CartItem[] | undefined;
};

const noProductIds: string[] = [];

export function useProductCollection(
  collection: Collection,
  userId: string | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const scopedUserId = userId ?? 'anonymous';
  const queryKey =
    collection === 'cart'
      ? queryKeys.cart.productIds(scopedUserId)
      : queryKeys.watchlist.productIds(scopedUserId);
  const cartItemsKey = queryKeys.cart.items(scopedUserId);
  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      const response = await api.get(
        collection === 'cart' ? apiRoutes.cart : apiRoutes.watchlist,
      );
      const entries: CollectionEntry[] =
        collection === 'cart' ? response.data.items : response.data;
      return entries.map(({ product }) =>
        typeof product === 'string' ? product : product._id,
      );
    },
  });
  const mutation = useMutation<void, Error, ToggleVariables, MutationContext>({
    mutationFn: async ({ productId, remove }) => {
      if (remove) {
        await api.delete(
          collection === 'cart'
            ? apiRoutes.cartItem(productId)
            : apiRoutes.watchlistItem(productId),
        );
      } else if (collection === 'cart') {
        await api.put(apiRoutes.cartItems, { productId, quantity: 1 });
      } else {
        await api.put(apiRoutes.watchlistItem(productId));
      }
    },
    onMutate: async ({ productId, remove }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey }),
        ...(collection === 'cart'
          ? [queryClient.cancelQueries({ queryKey: cartItemsKey })]
          : []),
      ]);
      const previous = queryClient.getQueryData<string[]>(queryKey);
      const previousCartItems =
        queryClient.getQueryData<CartItem[]>(cartItemsKey);
      queryClient.setQueryData<string[]>(queryKey, (current = noProductIds) =>
        remove
          ? current.filter((id) => id !== productId)
          : [...new Set([...current, productId])],
      );
      if (collection === 'cart' && remove) {
        queryClient.setQueryData<CartItem[]>(cartItemsKey, (current = []) =>
          current.filter((item) => item.product._id !== productId),
        );
      }
      return { previous, previousCartItems };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous === undefined) {
        queryClient.removeQueries({ queryKey, exact: true });
      } else {
        queryClient.setQueryData(queryKey, context.previous);
      }
      if (collection === 'cart') {
        if (context?.previousCartItems === undefined) {
          queryClient.removeQueries({ queryKey: cartItemsKey, exact: true });
        } else {
          queryClient.setQueryData(cartItemsKey, context.previousCartItems);
        }
      }
    },
    onSuccess: () => {
      if (enabled) {
        void queryClient.invalidateQueries({ queryKey });
        if (collection === 'cart') {
          void queryClient.invalidateQueries({
            queryKey: cartItemsKey,
            refetchType: 'inactive',
          });
        }
      }
    },
  });

  return {
    productIds: query.data ?? noProductIds,
    isLoadError: query.isError && query.data === undefined,
    toggle: mutation.mutateAsync,
  };
}
