import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { queryKeys, type ReviewListRequest } from '@/serverState/queryKeys';
import {
  createReview,
  listReviews,
  type CreateReviewMutation,
  type ReviewList,
} from '@/services/reviews';

export type { Review } from '@/services/reviews';
export type ReviewQueryData = ReviewList;

export const reviewQueries = {
  list: (request: ReviewListRequest) =>
    queryOptions({
      queryKey: queryKeys.reviews.list(request),
      queryFn: () => listReviews(request),
    }),
};

export function useReviewList(request: ReviewListRequest, enabled: boolean) {
  return useQuery({
    ...reviewQueries.list(request),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCreateReview(
  productId: string | undefined,
  request: ReviewListRequest,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReviewMutation) =>
      createReview(productId!, input),
    onSuccess: (review) => {
      queryClient.setQueryData<ReviewQueryData>(
        queryKeys.reviews.list(request),
        (current) =>
          current
            ? {
                ...current,
                items: [
                  review,
                  ...current.items.filter((item) => item._id !== review._id),
                ],
              }
            : current,
      );
      if (productId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.reviews.lists(productId),
          refetchType: 'inactive',
        });
      }
    },
  });
}
