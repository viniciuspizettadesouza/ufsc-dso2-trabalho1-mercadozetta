import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '@/services/api';
import {
  createReview,
  listReviews,
  type Review,
  type ReviewList,
} from '@/services/reviews';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const review = {
  _id: '11111111-1111-4111-8111-111111111111',
  tenantId: 'mercadozetta',
  author: '22222222-2222-4222-8222-222222222222',
  product: '33333333-3333-4333-8333-333333333333',
  rating: 5,
  comment: 'Excellent product',
  createdAt: '2026-07-18T10:00:00.000Z',
  updatedAt: '2026-07-18T10:00:00.000Z',
} satisfies Review;
const reviews = {
  items: [review],
  page: { limit: 20, offset: 0, total: 1, hasMore: false },
} satisfies ReviewList;

describe('review service', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  it('loads an unpaginated review list through the shared route', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: reviews });

    await expect(
      listReviews({ productId: 'product-1', limit: null, offset: null }),
    ).resolves.toBe(reviews);

    expect(api.get).toHaveBeenCalledWith('/products/product-1/reviews');
  });

  it('serializes paginated review list requests', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: reviews });

    await listReviews({ productId: 'product-1', limit: 20, offset: 40 });

    expect(api.get).toHaveBeenCalledWith(
      '/products/product-1/reviews?limit=20&offset=40',
    );
  });

  it('upserts a review and returns the server review', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: review });
    const input = {
      rating: 5,
      comment: 'Excellent product',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    };

    await expect(createReview('product-1', input)).resolves.toBe(review);

    const { idempotencyKey, ...body } = input;
    expect(api.post).toHaveBeenCalledWith('/products/product-1/reviews', body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  });
});
