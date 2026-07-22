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
type ToggleResult = CartItem[] | undefined;
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
  const mutation = useMutation<
    ToggleResult,
    Error,
    ToggleVariables,
    MutationContext
  >({
    mutationFn: async ({ productId, remove }) => {
      if (remove) {
        if (collection === 'cart') {
          return (await removeCartItem(productId)).items;
        } else {
          await removeWatchlistItem(productId);
        }
      } else if (collection === 'cart') {
        return (await putCartItem({ productId, quantity: 1 })).items;
      } else {
        await putWatchlistItem(productId);
      }

      return undefined;
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
    onSuccess: (cartItems) => {
      if (collection === 'cart' && cartItems) {
        queryClient.setQueryData<CartItem[]>(cartItemsKey, cartItems);
        queryClient.setQueryData<string[]>(
          queryKey,
          cartItems.map(({ product }) => product._id),
        );
      }
      if (enabled) {
        void queryClient.invalidateQueries({ queryKey });
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
