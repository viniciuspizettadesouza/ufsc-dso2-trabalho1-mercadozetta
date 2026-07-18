import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { pageInfo, pageItems, withPage, type PageInfo } from '@/pagination';
import { apiRoutes } from '@/routes';
import api from '@/services/api';
import { queryKeys, type ReviewListRequest } from '@/serverState/queryKeys';

export type Review = { _id: string; rating: number; comment: string };
export type ReviewQueryData = { items: Review[]; page: PageInfo };

export const reviewQueries = {
  list: (request: ReviewListRequest) =>
    queryOptions({
      queryKey: queryKeys.reviews.list(request),
      queryFn: async () => {
        const path =
          request.limit === null || request.offset === null
            ? apiRoutes.reviews(request.productId)
            : withPage(
                apiRoutes.reviews(request.productId),
                request.offset,
                request.limit,
              );
        const response = await api.get(path);
        return {
          items: pageItems<Review>(response.data),
          page: pageInfo<Review>(response.data),
        };
      },
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
    mutationFn: async ({ rating, comment }: Omit<Review, '_id'>) => {
      const response = await api.post(apiRoutes.reviews(productId!), {
        rating,
        comment,
      });
      return response.data as Review;
    },
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
