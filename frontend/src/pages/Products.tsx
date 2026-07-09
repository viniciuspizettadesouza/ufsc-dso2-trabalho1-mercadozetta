import { ChangeEvent, useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router';

import api from '../services/api';
import { useBrand } from '../brands/brandContext';
import { apiRoutes, appRoutes } from '../routes';

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

const productSkeletons = ['skeleton-1', 'skeleton-2', 'skeleton-3', 'skeleton-4'];

function getStoredIds(key: string) {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]') as string[];
    } catch {
        return [];
    }
}

function toggleStoredId(key: string, id: string) {
    const ids = getStoredIds(key);
    const nextIds = ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id];

    localStorage.setItem(key, JSON.stringify(nextIds));
    return nextIds;
}

export default function Products() {
    const brand = useBrand();
    const { sellerId } = useParams();
    const [products, setProducts] = useState<Product[]>([]);
    const [newProducts, setNewProducts] = useState<Product[]>([]);
    const [produto, setProduto] = useState('');
    const [category, setCategory] = useState('');
    const [availability, setAvailability] = useState('');
    const [sort, setSort] = useState('created_desc');
    const [favorites, setFavorites] = useState<string[]>(() => getStoredIds('favorites'));
    const [cart, setCart] = useState<string[]>(() => getStoredIds('cart'));
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    async function loadProducts() {
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

            const basePath = sellerId ? apiRoutes.sellerProducts(sellerId) : apiRoutes.products;
            const path = params.toString() ? `${basePath}?${params.toString()}` : basePath;
            const response = await api.get(path)

            setProducts(response.data)
            setNewProducts(response.data)
        } catch {
            setProducts([])
            setNewProducts([])
            setError(brand.copy.catalog.loadError)
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        async function loadInitialProducts() {
            try {
                setIsLoading(true);
                setError('');
                const path = sellerId ? apiRoutes.sellerProducts(sellerId) : apiRoutes.products;
                const response = await api.get(path)
                setProducts(response.data)
                setNewProducts(response.data)
            } catch {
                setProducts([])
                setNewProducts([])
                setError(brand.copy.catalog.loadError)
            } finally {
                setIsLoading(false);
            }
        }
        loadInitialProducts();
    }, [brand.copy.catalog.loadError, sellerId]);

    const procure = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const value = event.currentTarget.value;
        const normalizedValue = value.toLowerCase();

        setProduto(value)
        if (value.length > 1) {
            setNewProducts(products.filter(p => (
                p.name.toLowerCase().includes(normalizedValue) ||
                p.description.toLowerCase().includes(normalizedValue)
            )))
        } else {
            setNewProducts(products)
        }
    }, [products])

    return (
        <section className="mx-auto max-w-[1180px] px-5 py-8">
            <form className="grid gap-3 rounded border border-solid border-[#e5e7eb] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.08)] md:grid-cols-[minmax(220px,1fr)_170px_190px_170px_auto]" onSubmit={event => {
                event.preventDefault();
                loadProducts();
            }}>
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
                        onChange={e => setCategory(e.target.value)}
                    />
                </label>
                <label className="flex flex-col gap-1 text-sm font-bold text-[#374151]">
                    {brand.copy.catalog.availabilityFilterLabel}
                    <select
                        aria-label={brand.copy.catalog.availabilityFilterLabel}
                        className="h-11 rounded border border-solid border-[#d1d5db] px-3 text-base font-normal text-[#111827]"
                        value={availability}
                        onChange={e => setAvailability(e.target.value)}
                    >
                        <option value="">{brand.copy.catalog.availabilityAnyLabel}</option>
                        <option value="in_stock">{brand.copy.catalog.availabilityInStockLabel}</option>
                        <option value="sold_out">{brand.copy.catalog.availabilitySoldOutLabel}</option>
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-bold text-[#374151]">
                    {brand.copy.catalog.sortLabel}
                    <select
                        aria-label={brand.copy.catalog.sortLabel}
                        className="h-11 rounded border border-solid border-[#d1d5db] px-3 text-base font-normal text-[#111827]"
                        value={sort}
                        onChange={e => setSort(e.target.value)}
                    >
                        <option value="created_desc">{brand.copy.catalog.sortNewestLabel}</option>
                        <option value="created_asc">{brand.copy.catalog.sortOldestLabel}</option>
                        <option value="name_asc">{brand.copy.catalog.sortNameLabel}</option>
                        <option value="inventory_desc">{brand.copy.catalog.sortInventoryLabel}</option>
                    </select>
                </label>
                <button
                    className="h-11 self-end rounded bg-[var(--brand-secondary)] px-5 text-sm font-bold text-white"
                    type="submit"
                >
                    {brand.copy.catalog.searchAction}
                </button>
            </form>

            <div className="py-8">
                {isLoading ? (
                    <div role="status" aria-label={brand.copy.catalog.loading}>
                        <p className="sr-only">{brand.copy.catalog.loading}</p>
                        <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
                            {productSkeletons.map(item => (
                                <li className="overflow-hidden rounded border border-solid border-[#e5e7eb] bg-white" key={item}>
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
                    <div role="alert" className="rounded border border-solid border-red-200 bg-red-50 p-5 text-base font-bold text-red-700">
                        {error}
                    </div>
                ) : newProducts.length > 0 ? (
                    <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
                        {newProducts.map(product => (
                            <li className="flex min-h-full flex-col overflow-hidden rounded border border-solid border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]" key={product._id}>
                                <Link className="block bg-[#f3f4f6]" to={appRoutes.productDetail(product._id)}>
                                    <img className="aspect-[4/3] w-full object-cover" src={product.image} alt={product.name} />
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
                                        <span className="font-bold">{brand.copy.catalog.descriptionLabel}</span>{' '}
                                        {product.description}
                                    </p>
                                    <dl className="grid gap-2 text-sm text-[#4b5563]">
                                        {product.category && (
                                            <div className="flex items-start justify-between gap-3">
                                                <dt className="font-bold">{brand.copy.catalog.categoryLabel}</dt>
                                                <dd className="text-right">{product.category}</dd>
                                            </div>
                                        )}
                                        {brand.features.inventory && product.inventory !== undefined && (
                                            <div className="flex items-start justify-between gap-3">
                                                <dt className="font-bold">{brand.copy.catalog.inventoryLabel}</dt>
                                                <dd className={product.inventory > 0 ? 'font-bold text-[var(--brand-accent)]' : 'font-bold text-red-600'}>
                                                    {product.inventory > 0 ? product.inventory : brand.copy.catalog.soldOutLabel}
                                                </dd>
                                            </div>
                                        )}
                                        {product.status && (
                                            <div className="flex items-start justify-between gap-3">
                                                <dt className="font-bold">{brand.copy.catalog.statusLabel}</dt>
                                                <dd className="rounded bg-[#eef2ff] px-2 py-0.5 text-right text-xs font-bold text-[#3730a3]">
                                                    {brand.copy.catalog.statusLabels[product.status]}
                                                </dd>
                                            </div>
                                        )}
                                        {product.seller && (
                                            <div className="flex items-start justify-between gap-3">
                                                <dt className="font-bold">{brand.copy.catalog.sellerLabel}</dt>
                                                <dd className="text-right">
                                                    <Link className="font-bold text-[var(--brand-secondary)]" to={appRoutes.sellerProfile(product.seller)}>
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
                                        <button
                                            className="min-h-10 rounded border border-solid border-[#d1d5db] px-2 text-sm font-bold text-[#374151]"
                                            type="button"
                                            onClick={() => setFavorites(toggleStoredId('favorites', product._id))}
                                        >
                                            {favorites.includes(product._id) ? brand.copy.catalog.watchingAction : brand.copy.catalog.watchAction}
                                        </button>
                                        <button
                                            className="col-span-2 min-h-10 rounded border border-solid border-[#d1d5db] px-2 text-sm font-bold text-[#374151]"
                                            type="button"
                                            onClick={() => setCart(toggleStoredId('cart', product._id))}
                                        >
                                            {cart.includes(product._id) ? brand.copy.catalog.inCartAction : brand.copy.catalog.cartAction}
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="rounded border border-dashed border-[#cbd5e1] bg-white p-8 text-center">
                        <h2 className="text-xl font-bold text-[#4b5563]">{brand.copy.catalog.empty}</h2>
                    </div>
                )}
            </div>
        </section>
    );
}
