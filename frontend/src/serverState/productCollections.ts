import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/serverState/queryKeys';
import type { CartItem } from '@/serverState/cart';
import { getCart, putCartItem, removeCartItem } from '@/services/cart';
import {
  getWatchlist,
  putWatchlistItem,
  removeWatchlistItem,
} from '@/services/watchlist';

type Collection = 'cart' | 'watchlist';
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
    queryFn: () => loadCollectionProductIds(collection),
  });
  const mutation = useMutation<void, Error, ToggleVariables, MutationContext>({
    mutationFn: async ({ productId, remove }) => {
      if (remove) {
        if (collection === 'cart') {
          await removeCartItem(productId);
        } else {
          await removeWatchlistItem(productId);
        }
      } else if (collection === 'cart') {
        await putCartItem({ productId, quantity: 1 });
      } else {
        await putWatchlistItem(productId);
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

async function loadCollectionProductIds(collection: Collection) {
  if (collection === 'cart') {
    const cart = await getCart();
    return cart.items.map(({ product }) => product._id);
  }

  const watchlist = await getWatchlist();
  return watchlist.map(({ product }) => product._id);
}
