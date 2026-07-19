import type { components } from '@/contracts/api';
import { withPage } from '@/pagination';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type Review = components['schemas']['Review'];
export type ReviewList = components['schemas']['ReviewList'];
export type CreateReviewInput = components['schemas']['CreateReviewRequest'];
export type CreateReviewMutation = CreateReviewInput & {
  idempotencyKey: string;
};
export type ReviewListRequest = {
  productId: string;
  limit: number | null;
  offset: number | null;
};

export async function listReviews(
  request: ReviewListRequest,
): Promise<ReviewList> {
  const response = await api.get<ReviewList>(reviewListPath(request));
  return response.data;
}

export async function createReview(
  productId: string,
  input: CreateReviewMutation,
): Promise<Review> {
  const { idempotencyKey, ...body } = input;
  const response = await api.post<Review>(apiRoutes.reviews(productId), body, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data;
}

function reviewListPath(request: ReviewListRequest) {
  const path = apiRoutes.reviews(request.productId);
  return request.limit === null || request.offset === null
    ? path
    : withPage(path, request.offset, request.limit);
}
