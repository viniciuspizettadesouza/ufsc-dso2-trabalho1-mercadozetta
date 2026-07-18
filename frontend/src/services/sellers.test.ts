import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import { getSeller, type Seller } from '@/services/sellers';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

const seller = {
  _id: '11111111-1111-4111-8111-111111111111',
  username: 'Seller',
  telephone: '+5548999999999',
  email: 'seller@example.com',
  storeName: 'Seller store',
} satisfies Seller;

describe('seller service', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('loads a seller profile through the shared route', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: seller });

    await expect(getSeller(seller._id)).resolves.toBe(seller);

    expect(api.get).toHaveBeenCalledWith(`/users/${seller._id}`);
  });
});
