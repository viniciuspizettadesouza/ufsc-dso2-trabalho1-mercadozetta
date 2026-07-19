import { FormEvent, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import Header from '@/pages/header';
import { useBrand } from '@/brands/brandContext';
import { appRoutes } from '@/routes';
import { useAuth } from '@/auth/AuthContext';
import PaginationControls from '@/components/PaginationControls';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import {
  MutationFeedbackMessage,
  type MutationFeedback,
} from '@/components/MutationFeedback';
import { firstPage } from '@/pagination';
import type { ReviewListRequest } from '@/serverState/queryKeys';
import { useProductCollection } from '@/serverState/productCollections';
import { useProductDetail } from '@/serverState/products';
import {
  type Review,
  useCreateReview,
  useReviewList,
} from '@/serverState/reviews';
import { createIdempotencyKey } from '@/services/idempotency';
const noReviews: Review[] = [];

export default function ProductDetail() {
  const { productId } = useParams();

  return (
    <ProductDetailPage
      key={productId ?? 'missing-product'}
      productId={productId}
    />
  );
}

function ProductDetailPage({ productId }: { productId?: string }) {
  const brand = useBrand();
  const { status, user } = useAuth();
  const [rating, setRating] = useState('5');
  const reviewIdempotency = useRef<{
    key: string;
    fingerprint: string;
  } | null>(null);
  const [comment, setComment] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [actionFeedback, setActionFeedback] = useState<MutationFeedback>(null);
  const [reviewRequest, setReviewRequest] = useState<ReviewListRequest>(() => ({
    productId: productId ?? 'missing-product',
    limit: null,
    offset: null,
  }));
  const productQuery = useProductDetail(
    productId ?? 'missing-product',
    Boolean(productId),
  );
  const product = productQuery.data;
  const reviewQuery = useReviewList(reviewRequest, Boolean(productId));
  const reviewMutation = useCreateReview(productId, reviewRequest);
  const reviews = reviewQuery.data?.items ?? noReviews;
  const reviewPage = reviewQuery.data?.page ?? firstPage;
  const watchlist = useProductCollection(
    'watchlist',
    user?._id,
    status === 'authenticated',
  );
  const cart = useProductCollection(
    'cart',
    user?._id,
    status === 'authenticated',
  );
  const watched = productId ? watchlist.productIds.includes(productId) : false;
  const inCart = productId ? cart.productIds.includes(productId) : false;

  async function loadReviews(offset: number) {
    if (!productId) return;
    setReviewRequest({
      productId,
      limit: reviewPage.limit,
      offset,
    });
  }

  async function toggleWatch() {
    if (!productId) return;
    try {
      setPendingAction('watchlist');
      setActionFeedback(null);
      await watchlist.toggle({ productId, remove: watched });
      setActionFeedback({
        type: 'success',
        message: watched ? 'Removed from watchlist.' : 'Added to watchlist.',
      });
    } catch {
      setActionFeedback({
        type: 'error',
        message: 'Unable to update watchlist.',
      });
    } finally {
      setPendingAction('');
    }
  }
  async function toggleCart() {
    if (!productId) return;
    try {
      setPendingAction('cart');
      setActionFeedback(null);
      await cart.toggle({ productId, remove: inCart });
      setActionFeedback({
        type: 'success',
        message: inCart ? 'Removed from cart.' : 'Added to cart.',
      });
    } catch {
      setActionFeedback({ type: 'error', message: 'Unable to update cart.' });
    } finally {
      setPendingAction('');
    }
  }
  async function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productId || !comment.trim()) return;
    try {
      setPendingAction('review');
      setActionFeedback(null);
      const review = {
        rating: Number(rating),
        comment: comment.trim(),
      };
      const fingerprint = JSON.stringify(review);
      if (reviewIdempotency.current?.fingerprint !== fingerprint) {
        reviewIdempotency.current = {
          key: createIdempotencyKey(),
          fingerprint,
        };
      }
      await reviewMutation.mutateAsync({
        ...review,
        idempotencyKey: reviewIdempotency.current.key,
      });
      reviewIdempotency.current = null;
      setComment('');
      setActionFeedback({ type: 'success', message: 'Review added.' });
    } catch {
      setActionFeedback({ type: 'error', message: 'Unable to add review.' });
    } finally {
      setPendingAction('');
    }
  }

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[980px] px-4 py-8">
        {(productQuery.isError && !product) ||
        (reviewQuery.isError &&
          reviewQuery.data === undefined &&
          reviewRequest.offset === null) ||
        watchlist.isLoadError ||
        cart.isLoadError ? (
          <p role="alert" className="text-xl font-bold text-red-700">
            Unable to load product.
          </p>
        ) : !product || reviewQuery.isPending ? (
          <p role="status">Loading product...</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-[360px_1fr]">
            <img
              className="w-full rounded-surface object-cover"
              src={product.image}
              alt={product.name}
            />
            <section>
              <h1 className="text-3xl font-bold">{product.name}</h1>
              <p className="mt-4 text-muted">{product.description}</p>
              <dl className="mt-5 grid gap-2 text-sm">
                <div>
                  <dt className="inline font-bold">
                    {brand.copy.catalog.categoryLabel}
                  </dt>{' '}
                  <dd className="inline">{product.category || 'general'}</dd>
                </div>
                {product.inventory !== undefined && (
                  <div>
                    <dt className="inline font-bold">
                      {brand.copy.catalog.inventoryLabel}
                    </dt>{' '}
                    <dd className="inline">{product.inventory}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-5 rounded-surface border border-theme-border bg-surface p-4 shadow-surface">
                <h2 className="font-bold">
                  {product.sellerProfile?.storeName || 'Seller store'}
                </h2>
                <p>{product.sellerProfile?.username || product.seller}</p>
                {product.seller && (
                  <Link to={appRoutes.sellerProfile(product.seller)}>
                    Store profile
                  </Link>
                )}
              </div>
              <div className="mt-5 flex gap-2">
                <Button
                  type="button"
                  disabled={Boolean(pendingAction)}
                  onClick={toggleWatch}
                >
                  {pendingAction === 'watchlist'
                    ? 'Updating watchlist...'
                    : watched
                      ? 'Watching'
                      : 'Watch'}
                </Button>
                <Button
                  type="button"
                  disabled={Boolean(pendingAction)}
                  onClick={toggleCart}
                >
                  {pendingAction === 'cart'
                    ? 'Updating cart...'
                    : inCart
                      ? 'In cart'
                      : 'Add to cart'}
                </Button>
                <Link to={appRoutes.checkout}>Checkout</Link>
              </div>
              <MutationFeedbackMessage
                className="mt-3"
                feedback={actionFeedback}
              />
              <section className="mt-8">
                <h2 className="text-xl font-bold">Reviews and rating</h2>
                <form
                  className="mt-3 flex flex-wrap gap-2"
                  onSubmit={handleReview}
                >
                  <label className="sr-only" htmlFor="rating">
                    Rating
                  </label>
                  <Select
                    id="rating"
                    value={rating}
                    onChange={(event) => setRating(event.target.value)}
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </Select>
                  <label className="sr-only" htmlFor="review">
                    Review
                  </label>
                  <Input
                    id="review"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Review this product"
                  />
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={Boolean(pendingAction)}
                  >
                    {pendingAction === 'review'
                      ? 'Adding review...'
                      : 'Add review'}
                  </Button>
                </form>
                <ul>
                  {reviews.map((review) => (
                    <li key={review._id}>
                      <strong>{review.rating}/5</strong> {review.comment}
                    </li>
                  ))}
                </ul>
                <PaginationControls
                  label="Review pages"
                  page={reviewPage}
                  onPage={loadReviews}
                />
              </section>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
