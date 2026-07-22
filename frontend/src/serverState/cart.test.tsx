import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import { createQueryClient } from '@/serverState/createQueryClient';
import { useDetailedCart } from '@/serverState/cart';
import { queryKeys } from '@/serverState/queryKeys';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const item = {
  product: { _id: 'product-1', name: 'Coffee', inventory: 3, status: 'active' },
  quantity: 1,
};

function renderCart() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(() => useDetailedCart('user-1'), { wrapper });
  return { ...rendered, queryClient };
}

describe('useDetailedCart', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.put).mockReset();
    vi.mocked(api.delete).mockReset();
    vi.mocked(api.get).mockResolvedValue({ data: { items: [item] } } as never);
  });

  it('rolls an optimistic quantity update back on failure', async () => {
    vi.mocked(api.put).mockRejectedValue(new Error('network error'));
    const { result } = renderCart();

    await waitFor(() => expect(result.current.items).toEqual([item]));
    await act(async () => {
      await expect(
        result.current.updateQuantity({ productId: 'product-1', quantity: 2 }),
      ).rejects.toThrow('network error');
    });

    expect(result.current.items).toEqual([item]);
    expect(api.put).toHaveBeenCalledWith('/cart/items', {
      productId: 'product-1',
      quantity: 2,
    });
  });

  it('rolls detailed items and product IDs back together', async () => {
    let rejectRemoval!: (error: Error) => void;
    vi.mocked(api.delete).mockReturnValue(
      new Promise<void>((_resolve, reject) => {
        rejectRemoval = reject;
      }) as never,
    );
    const { result, queryClient } = renderCart();

    await waitFor(() => expect(result.current.items).toEqual([item]));
    queryClient.setQueryData(queryKeys.cart.productIds('user-1'), [
      'product-1',
    ]);
    let mutation!: Promise<unknown>;
    act(() => {
      mutation = result.current.removeItem('product-1');
    });
    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(
      queryClient.getQueryData(queryKeys.cart.productIds('user-1')),
    ).toEqual([]);

    rejectRemoval(new Error('network error'));
    await act(async () => {
      await expect(mutation).rejects.toThrow('network error');
    });

    await waitFor(() => expect(result.current.items).toEqual([item]));
    await waitFor(() =>
      expect(
        queryClient.getQueryData(queryKeys.cart.productIds('user-1')),
      ).toEqual(['product-1']),
    );
  });
});
