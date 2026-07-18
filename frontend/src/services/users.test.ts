import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import { createUser, type User } from '@/services/users';

vi.mock('@/services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

const user = {
  _id: '11111111-1111-4111-8111-111111111111',
  tenantId: 'mercadozetta',
  email: 'seller@example.com',
  username: 'Seller',
  telephone: '+5548999999999',
  createdAt: '2026-07-18T10:00:00.000Z',
  updatedAt: '2026-07-18T10:00:00.000Z',
} satisfies User;

describe('user service', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('registers a user through the shared route and returns the user', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: user });
    const input = {
      email: 'seller@example.com',
      password: 'secret123',
      username: 'Seller',
      telephone: '+5548999999999',
    };

    await expect(createUser(input)).resolves.toBe(user);

    expect(api.post).toHaveBeenCalledWith('/users', input);
  });
});
