import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import { createQueryClient } from '@/serverState/createQueryClient';
import { useProductCollection } from '@/serverState/productCollections';
import { queryKeys } from '@/serverState/queryKeys';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

function renderCollection(
  collection: 'cart' | 'watchlist',
  userId: string | undefined,
  enabled: boolean,
) {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const rendered = renderHook(
    () => useProductCollection(collection, userId, enabled),
    {
      wrapper,
    },
  );
  return { ...rendered, queryClient };
}

describe('useProductCollection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.put).mockReset();
    vi.mocked(api.delete).mockReset();
  });

  it('optimistically adds and then revalidates authenticated state', async () => {
    let resolveMutation!: (response: { data: unknown }) => void;
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: [] } as never)
      .mockResolvedValueOnce({ data: [{ product: 'product-1' }] } as never);
    vi.mocked(api.put).mockReturnValue(
      new Promise((resolve) => {
        resolveMutation = resolve;
      }) as never,
    );
    const { result } = renderCollection('watchlist', 'user-1', true);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/watchlist'));
    let mutation!: Promise<unknown>;
    act(() => {
      mutation = result.current.toggle({
        productId: 'product-1',
        remove: false,
      });
    });
    await waitFor(() =>
      expect(result.current.productIds).toEqual(['product-1']),
    );

    resolveMutation({ data: {} });
    await act(async () => mutation);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(api.put).toHaveBeenCalledWith('/watchlist/product-1');
  });

  it('rolls an optimistic removal back after an API error', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { items: [{ product: { _id: 'product-1' } }] },
    } as never);
    vi.mocked(api.delete).mockRejectedValue(new Error('network error'));
    const { result, queryClient } = renderCollection('cart', 'user-1', true);

    await waitFor(() =>
      expect(result.current.productIds).toEqual(['product-1']),
    );
    queryClient.setQueryData(queryKeys.cart.items('user-1'), [
      { product: { _id: 'product-1', name: 'Coffee' }, quantity: 1 },
    ]);
    await act(async () => {
      await expect(
        result.current.toggle({ productId: 'product-1', remove: true }),
      ).rejects.toThrow('network error');
    });

    expect(result.current.productIds).toEqual(['product-1']);
    expect(queryClient.getQueryData(queryKeys.cart.items('user-1'))).toEqual([
      { product: { _id: 'product-1', name: 'Coffee' }, quantity: 1 },
    ]);
    expect(api.delete).toHaveBeenCalledWith('/cart/items/product-1');
  });

  it('keeps anonymous reads disabled while preserving mutation controls', async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: {
        items: [{ product: { _id: 'product-1' }, quantity: 1 }],
      },
    } as never);
    const { result } = renderCollection('cart', undefined, false);

    await act(async () => {
      await result.current.toggle({ productId: 'product-1', remove: false });
    });

    expect(api.get).not.toHaveBeenCalled();
    expect(api.put).toHaveBeenCalledWith('/cart/items', {
      productId: 'product-1',
      quantity: 1,
    });
    await waitFor(() =>
      expect(result.current.productIds).toEqual(['product-1']),
    );
  });
});
