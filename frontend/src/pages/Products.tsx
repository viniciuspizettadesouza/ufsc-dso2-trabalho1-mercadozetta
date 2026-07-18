import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { useBrand } from '@/brands/brandContext';
import { appRoutes } from '@/routes';
import { useAuth } from '@/auth/AuthContext';
import PaginationControls from '@/components/PaginationControls';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { firstPage } from '@/pagination';
import type { ProductListRequest } from '@/serverState/queryKeys';
import { useProductCollection } from '@/serverState/productCollections';
import { type Product, useProductList } from '@/serverState/products';

type ActionFeedback = { type: 'success' | 'error'; message: string } | null;

const productSkeletons = [
  'skeleton-1',
  'skeleton-2',
  'skeleton-3',
  'skeleton-4',
];
const noProducts: Product[] = [];

export default function Products() {
  const { sellerId } = useParams();

  return (
    <ProductCatalog key={sellerId ?? 'all-products'} sellerId={sellerId} />
  );
}

function ProductCatalog({ sellerId }: { sellerId?: string }) {
  const brand = useBrand();
  const { status, user } = useAuth();
  const [produto, setProduto] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [sort, setSort] = useState('created_desc');
  const [pendingAction, setPendingAction] = useState('');
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback>(null);
  const [productRequest, setProductRequest] = useState<ProductListRequest>(() =>
    initialProductRequest(sellerId),
  );

  const productQuery = useProductList(productRequest);
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

  const products = productQuery.data?.items ?? noProducts;
  const page = productQuery.data?.page ?? firstPage;
  const normalizedSearch = produto.toLowerCase();
  const visibleProducts = useMemo(
    () =>
      produto.length > 1 && produto.trim() !== productRequest.q
        ? products.filter(
            (product) =>
              product.name.toLowerCase().includes(normalizedSearch) ||
              product.description.toLowerCase().includes(normalizedSearch),
          )
        : products,
    [normalizedSearch, productRequest.q, products, produto],
  );

  function loadProducts(offset = 0) {
    const nextRequest: ProductListRequest = {
      sellerId: sellerId ?? null,
      q: produto.trim().length > 1 ? produto.trim() : '',
      category,
      availability,
      sort,
      limit: page.limit,
      offset,
    };

    if (sameProductRequest(productRequest, nextRequest)) {
      void productQuery.refetch();
    } else {
      setProductRequest(nextRequest);
    }
  }

  async function toggleFavorite(productId: string) {
    const action = `watchlist-${productId}`;
    const isRemoving = watchlist.productIds.includes(productId);
    try {
      setPendingAction(action);
      setActionFeedback(null);
      await watchlist.toggle({ productId, remove: isRemoving });
      setActionFeedback({
        type: 'success',
        message: isRemoving
          ? 'Produto removido dos favoritos.'
          : 'Produto adicionado aos favoritos.',
      });
    } catch {
      setActionFeedback({
        type: 'error',
        message: 'Não foi possível atualizar os favoritos.',
      });
    } finally {
      setPendingAction('');
    }
  }

  async function toggleCart(productId: string) {
    const action = `cart-${productId}`;
    const isRemoving = cart.productIds.includes(productId);
    try {
      setPendingAction(action);
      setActionFeedback(null);
      await cart.toggle({ productId, remove: isRemoving });
      setActionFeedback({
        type: 'success',
        message: isRemoving
          ? 'Produto removido do carrinho.'
          : 'Produto adicionado ao carrinho.',
      });
    } catch {
      setActionFeedback({
        type: 'error',
        message: 'Não foi possível atualizar o carrinho.',
      });
    } finally {
      setPendingAction('');
    }
  }

  return (
    <section className="mx-auto max-w-[1180px] px-5 py-8">
      <form
        className="grid gap-3 rounded-surface border border-solid border-theme-border bg-surface p-4 shadow-surface md:grid-cols-[minmax(220px,1fr)_170px_190px_170px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          loadProducts();
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-bold text-content">
          {brand.copy.catalog.searchPlaceholder}
          <Input
            className="h-11 text-base font-normal"
            type="text"
            placeholder={brand.copy.catalog.searchPlaceholder}
            value={produto}
            onChange={(event) => setProduto(event.currentTarget.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-content">
          {brand.copy.catalog.categoryFilterLabel}
          <Input
            aria-label={brand.copy.catalog.categoryFilterLabel}
            className="h-11 text-base font-normal"
            type="text"
            placeholder={brand.copy.catalog.categoryFilterPlaceholder}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-content">
          {brand.copy.catalog.availabilityFilterLabel}
          <Select
            aria-label={brand.copy.catalog.availabilityFilterLabel}
            className="h-11 text-base font-normal"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <option value="">{brand.copy.catalog.availabilityAnyLabel}</option>
            <option value="in_stock">
              {brand.copy.catalog.availabilityInStockLabel}
            </option>
            <option value="sold_out">
              {brand.copy.catalog.availabilitySoldOutLabel}
            </option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-content">
          {brand.copy.catalog.sortLabel}
          <Select
            aria-label={brand.copy.catalog.sortLabel}
            className="h-11 text-base font-normal"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="created_desc">
              {brand.copy.catalog.sortNewestLabel}
            </option>
            <option value="created_asc">
              {brand.copy.catalog.sortOldestLabel}
            </option>
            <option value="name_asc">{brand.copy.catalog.sortNameLabel}</option>
            <option value="inventory_desc">
              {brand.copy.catalog.sortInventoryLabel}
            </option>
          </Select>
        </label>
        <Button
          className="h-11 self-end px-5 text-sm"
          variant="primary"
          type="submit"
        >
          {brand.copy.catalog.searchAction}
        </Button>
      </form>

      {actionFeedback && (
        <p
          className={`mt-4 rounded-surface border p-3 font-bold ${
            actionFeedback.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-green-200 bg-green-50 text-green-700'
          }`}
          role={actionFeedback.type === 'error' ? 'alert' : 'status'}
        >
          {actionFeedback.message}
        </p>
      )}

      <div className="py-8">
        {productQuery.isPending ? (
          <div role="status" aria-label={brand.copy.catalog.loading}>
            <p className="sr-only">{brand.copy.catalog.loading}</p>
            <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {productSkeletons.map((item) => (
                <li
                  className="overflow-hidden rounded-surface border border-solid border-theme-border bg-surface"
                  key={item}
                >
                  <div className="aspect-[4/3] bg-theme-border" />
                  <div className="space-y-3 p-4">
                    <div className="h-5 w-3/4 rounded-control bg-theme-border" />
                    <div className="h-4 w-full rounded-control bg-canvas" />
                    <div className="h-4 w-2/3 rounded-control bg-canvas" />
                    <div className="h-9 w-full rounded-control bg-theme-border" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : productQuery.isError ? (
          <div
            role="alert"
            className="rounded-surface border border-solid border-red-200 bg-red-50 p-5 text-base font-bold text-red-700"
          >
            {brand.copy.catalog.loadError}
          </div>
        ) : visibleProducts.length > 0 ? (
          <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {visibleProducts.map((product) => (
              <li
                className="flex min-h-full flex-col overflow-hidden rounded-surface border border-solid border-theme-border bg-surface shadow-surface"
                key={product._id}
              >
                <Link
                  className="block bg-canvas"
                  to={appRoutes.productDetail(product._id)}
                >
                  <img
                    className="aspect-[4/3] w-full object-cover"
                    src={product.image}
                    alt={product.name}
                  />
                </Link>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <Link
                      className="line-clamp-2 min-h-12 text-base leading-6 font-bold text-content"
                      to={appRoutes.productDetail(product._id)}
                    >
                      {product.name}
                    </Link>
                    <p className="mt-1 text-lg font-bold text-accent">
                      {brand.copy.catalog.priceUnavailableLabel}
                    </p>
                  </div>
                  <p className="line-clamp-3 min-h-[72px] text-sm leading-6 text-muted">
                    <span className="font-bold">
                      {brand.copy.catalog.descriptionLabel}
                    </span>{' '}
                    {product.description}
                  </p>
                  <dl className="grid gap-2 text-sm text-muted">
                    {product.category && (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="font-bold">
                          {brand.copy.catalog.categoryLabel}
                        </dt>
                        <dd className="text-right">{product.category}</dd>
                      </div>
                    )}
                    {brand.features.inventory &&
                      product.inventory !== undefined && (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="font-bold">
                            {brand.copy.catalog.inventoryLabel}
                          </dt>
                          <dd
                            className={
                              product.inventory > 0
                                ? 'font-bold text-green-700'
                                : 'font-bold text-red-700'
                            }
                          >
                            {product.inventory > 0
                              ? product.inventory
                              : brand.copy.catalog.soldOutLabel}
                          </dd>
                        </div>
                      )}
                    {product.status && (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="font-bold">
                          {brand.copy.catalog.statusLabel}
                        </dt>
                        <dd className="rounded-control bg-slate-100 px-2 py-0.5 text-right text-xs font-bold text-slate-800">
                          {brand.copy.catalog.statusLabels[product.status]}
                        </dd>
                      </div>
                    )}
                    {product.seller && (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="font-bold">
                          {brand.copy.catalog.sellerLabel}
                        </dt>
                        <dd className="text-right">
                          <Link
                            className="font-bold text-action"
                            to={appRoutes.sellerProfile(product.seller)}
                          >
                            {product.seller}
                          </Link>
                        </dd>
                      </div>
                    )}
                  </dl>
                  <div className="mt-auto grid grid-cols-3 gap-2 pt-1">
                    <Link
                      className="col-span-3 inline-flex min-h-10 items-center justify-center rounded-control bg-action px-3 text-center text-sm font-bold text-on-action"
                      to={appRoutes.productDetail(product._id)}
                    >
                      {brand.copy.catalog.detailsAction}
                    </Link>
                    {product.seller === user?._id && (
                      <Link
                        className="col-span-3 text-center font-bold underline"
                        to={appRoutes.editProduct(product._id)}
                      >
                        Manage listing
                      </Link>
                    )}
                    <Button
                      className="px-2 text-sm"
                      type="button"
                      disabled={Boolean(pendingAction)}
                      onClick={() => toggleFavorite(product._id)}
                    >
                      {pendingAction === `watchlist-${product._id}`
                        ? 'Atualizando...'
                        : watchlist.productIds.includes(product._id)
                          ? brand.copy.catalog.watchingAction
                          : brand.copy.catalog.watchAction}
                    </Button>
                    <Button
                      className="col-span-2 px-2 text-sm"
                      type="button"
                      disabled={Boolean(pendingAction)}
                      onClick={() => toggleCart(product._id)}
                    >
                      {pendingAction === `cart-${product._id}`
                        ? 'Atualizando...'
                        : cart.productIds.includes(product._id)
                          ? brand.copy.catalog.inCartAction
                          : brand.copy.catalog.cartAction}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-surface border border-dashed border-theme-border bg-surface p-8 text-center">
            <h2 className="text-xl font-bold text-muted">
              {brand.copy.catalog.empty}
            </h2>
          </div>
        )}
      </div>
      <PaginationControls
        label="Product pages"
        page={page}
        onPage={loadProducts}
      />
    </section>
  );
}

function initialProductRequest(sellerId?: string): ProductListRequest {
  return {
    sellerId: sellerId ?? null,
    q: '',
    category: '',
    availability: '',
    sort: '',
    limit: null,
    offset: null,
  };
}

function sameProductRequest(
  current: ProductListRequest,
  next: ProductListRequest,
) {
  return (
    current.sellerId === next.sellerId &&
    current.q === next.q &&
    current.category === next.category &&
    current.availability === next.availability &&
    current.sort === next.sort &&
    current.limit === next.limit &&
    current.offset === next.offset
  );
}
