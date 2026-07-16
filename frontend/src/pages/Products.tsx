import { ChangeEvent, useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router';

import api from '@/services/api';
import { useBrand } from '@/brands/brandContext';
import { apiRoutes, appRoutes } from '@/routes';
import { useAuth } from '@/auth/AuthContext';
import PaginationControls from '@/components/PaginationControls';
import { firstPage, pageInfo, pageItems } from '@/pagination';

type Product = {
  _id: string;
  name: string;
  description: string;
  image: string;
  category?: string;
  subcategory?: string;
  inventory?: number;
  status?: 'draft' | 'active' | 'paused' | 'sold_out' | 'archived';
  seller?: string;
  createdAt?: string;
};

type ActionFeedback = { type: 'success' | 'error'; message: string } | null;

const productSkeletons = [
  'skeleton-1',
  'skeleton-2',
  'skeleton-3',
  'skeleton-4',
];

export default function Products() {
  const brand = useBrand();
  const { status, user } = useAuth();
  const { sellerId } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [produto, setProduto] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [sort, setSort] = useState('created_desc');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback>(null);
  const [page, setPage] = useState(firstPage);

  async function loadProducts(offset = 0) {
    try {
      setIsLoading(true);
      setError('');

      const params = new URLSearchParams();

      if (produto.trim().length > 1) {
        params.set('q', produto.trim());
      }

      if (category) {
        params.set('category', category);
      }

      if (availability) {
        params.set('availability', availability);
      }

      if (sort) {
        params.set('sort', sort);
      }
      params.set('limit', String(page.limit));
      params.set('offset', String(offset));

      const basePath = sellerId
        ? apiRoutes.sellerProducts(sellerId)
        : apiRoutes.products;
      const path = params.toString()
        ? `${basePath}?${params.toString()}`
        : basePath;
      const response = await api.get(path);

      const items = pageItems<Product>(response.data);
      setProducts(items);
      setNewProducts(items);
      setPage(pageInfo<Product>(response.data));
    } catch {
      setProducts([]);
      setNewProducts([]);
      setError(brand.copy.catalog.loadError);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    async function loadInitialProducts() {
      try {
        setIsLoading(true);
        setError('');
        const path = sellerId
          ? apiRoutes.sellerProducts(sellerId)
          : apiRoutes.products;
        const response = await api.get(path);
        const items = pageItems<Product>(response.data);
        setProducts(items);
        setNewProducts(items);
        setPage(pageInfo<Product>(response.data));
      } catch {
        setProducts([]);
        setNewProducts([]);
        setError(brand.copy.catalog.loadError);
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialProducts();
  }, [brand.copy.catalog.loadError, sellerId]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    Promise.all([api.get(apiRoutes.watchlist), api.get(apiRoutes.cart)]).then(
      ([watchlistResponse, cartResponse]) => {
        setFavorites(
          watchlistResponse.data.map((entry: { product: Product | string }) =>
            typeof entry.product === 'string'
              ? entry.product
              : entry.product._id,
          ),
        );
        setCart(
          cartResponse.data.items.map((entry: { product: Product | string }) =>
            typeof entry.product === 'string'
              ? entry.product
              : entry.product._id,
          ),
        );
      },
    );
  }, [status]);

  async function toggleFavorite(productId: string) {
    const action = `watchlist-${productId}`;
    const isRemoving = favorites.includes(productId);
    try {
      setPendingAction(action);
      setActionFeedback(null);
      if (isRemoving) {
        await api.delete(apiRoutes.watchlistItem(productId));
        setFavorites((current) => current.filter((id) => id !== productId));
      } else {
        await api.put(apiRoutes.watchlistItem(productId));
        setFavorites((current) => [...current, productId]);
      }
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
    const isRemoving = cart.includes(productId);
    try {
      setPendingAction(action);
      setActionFeedback(null);
      if (isRemoving) {
        await api.delete(apiRoutes.cartItem(productId));
        setCart((current) => current.filter((id) => id !== productId));
      } else {
        await api.put(apiRoutes.cartItems, { productId, quantity: 1 });
        setCart((current) => [...current, productId]);
      }
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

  const procure = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.currentTarget.value;
      const normalizedValue = value.toLowerCase();

      setProduto(value);
      if (value.length > 1) {
        setNewProducts(
          products.filter(
            (p) =>
              p.name.toLowerCase().includes(normalizedValue) ||
              p.description.toLowerCase().includes(normalizedValue),
          ),
        );
      } else {
        setNewProducts(products);
      }
    },
    [products],
  );

  return (
    <section className="mx-auto max-w-[1180px] px-5 py-8">
      <form
        className="grid gap-3 rounded border border-solid border-[#e5e7eb] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.08)] md:grid-cols-[minmax(220px,1fr)_170px_190px_170px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          loadProducts();
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-bold text-[#374151]">
          {brand.copy.catalog.searchPlaceholder}
          <input
            className="h-11 rounded border border-solid border-[#d1d5db] px-3 text-base font-normal text-[#111827] placeholder:text-[#9ca3af]"
            type="text"
            placeholder={brand.copy.catalog.searchPlaceholder}
            value={produto}
            onChange={procure}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-[#374151]">
          {brand.copy.catalog.categoryFilterLabel}
          <input
            aria-label={brand.copy.catalog.categoryFilterLabel}
            className="h-11 rounded border border-solid border-[#d1d5db] px-3 text-base font-normal text-[#111827] placeholder:text-[#9ca3af]"
            type="text"
            placeholder={brand.copy.catalog.categoryFilterPlaceholder}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-[#374151]">
          {brand.copy.catalog.availabilityFilterLabel}
          <select
            aria-label={brand.copy.catalog.availabilityFilterLabel}
            className="h-11 rounded border border-solid border-[#d1d5db] px-3 text-base font-normal text-[#111827]"
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
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold text-[#374151]">
          {brand.copy.catalog.sortLabel}
          <select
            aria-label={brand.copy.catalog.sortLabel}
            className="h-11 rounded border border-solid border-[#d1d5db] px-3 text-base font-normal text-[#111827]"
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
          </select>
        </label>
        <button
          className="h-11 self-end rounded bg-[var(--brand-secondary)] px-5 text-sm font-bold text-white"
          type="submit"
        >
          {brand.copy.catalog.searchAction}
        </button>
      </form>

      {actionFeedback && (
        <p
          className={`mt-4 rounded border p-3 font-bold ${
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
        {isLoading ? (
          <div role="status" aria-label={brand.copy.catalog.loading}>
            <p className="sr-only">{brand.copy.catalog.loading}</p>
            <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {productSkeletons.map((item) => (
                <li
                  className="overflow-hidden rounded border border-solid border-[#e5e7eb] bg-white"
                  key={item}
                >
                  <div className="aspect-[4/3] bg-[#e5e7eb]" />
                  <div className="space-y-3 p-4">
                    <div className="h-5 w-3/4 rounded bg-[#e5e7eb]" />
                    <div className="h-4 w-full rounded bg-[#eef0f3]" />
                    <div className="h-4 w-2/3 rounded bg-[#eef0f3]" />
                    <div className="h-9 w-full rounded bg-[#e5e7eb]" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded border border-solid border-red-200 bg-red-50 p-5 text-base font-bold text-red-700"
          >
            {error}
          </div>
        ) : newProducts.length > 0 ? (
          <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {newProducts.map((product) => (
              <li
                className="flex min-h-full flex-col overflow-hidden rounded border border-solid border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                key={product._id}
              >
                <Link
                  className="block bg-[#f3f4f6]"
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
                      className="line-clamp-2 min-h-12 text-base font-bold leading-6 text-[#111827]"
                      to={appRoutes.productDetail(product._id)}
                    >
                      {product.name}
                    </Link>
                    <p className="mt-1 text-lg font-bold text-[var(--brand-accent)]">
                      {brand.copy.catalog.priceUnavailableLabel}
                    </p>
                  </div>
                  <p className="line-clamp-3 min-h-[72px] text-sm leading-6 text-[#4b5563]">
                    <span className="font-bold">
                      {brand.copy.catalog.descriptionLabel}
                    </span>{' '}
                    {product.description}
                  </p>
                  <dl className="grid gap-2 text-sm text-[#4b5563]">
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
                                ? 'font-bold text-[var(--brand-accent)]'
                                : 'font-bold text-red-600'
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
                        <dd className="rounded bg-[#eef2ff] px-2 py-0.5 text-right text-xs font-bold text-[#3730a3]">
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
                            className="font-bold text-[var(--brand-secondary)]"
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
                      className="col-span-3 inline-flex min-h-10 items-center justify-center rounded bg-[var(--brand-secondary)] px-3 text-center text-sm font-bold text-white"
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
                    <button
                      className="min-h-10 rounded border border-solid border-[#d1d5db] px-2 text-sm font-bold text-[#374151]"
                      type="button"
                      disabled={Boolean(pendingAction)}
                      onClick={() => toggleFavorite(product._id)}
                    >
                      {pendingAction === `watchlist-${product._id}`
                        ? 'Atualizando...'
                        : favorites.includes(product._id)
                          ? brand.copy.catalog.watchingAction
                          : brand.copy.catalog.watchAction}
                    </button>
                    <button
                      className="col-span-2 min-h-10 rounded border border-solid border-[#d1d5db] px-2 text-sm font-bold text-[#374151]"
                      type="button"
                      disabled={Boolean(pendingAction)}
                      onClick={() => toggleCart(product._id)}
                    >
                      {pendingAction === `cart-${product._id}`
                        ? 'Atualizando...'
                        : cart.includes(product._id)
                          ? brand.copy.catalog.inCartAction
                          : brand.copy.catalog.cartAction}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded border border-dashed border-[#cbd5e1] bg-white p-8 text-center">
            <h2 className="text-xl font-bold text-[#4b5563]">
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
