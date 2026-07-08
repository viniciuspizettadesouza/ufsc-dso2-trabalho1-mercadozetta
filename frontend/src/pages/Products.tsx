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

        setProduto(value)
        if (value.length > 1) {
            setNewProducts(products.filter(p => p.name.toLowerCase().includes(value.toLowerCase())))
        } else if (value.length === 0) {
            setNewProducts(products)
        }
    }, [products])

    return (
        <div className="flex flex-col content-center justify-items-center">
            <div className="flex h-full items-center justify-center">
                <button
                    className="mt-2.5 flex h-12 w-full max-w-[300px] cursor-pointer flex-col items-center justify-center rounded border-0 bg-[var(--brand-secondary)] text-base font-bold text-white"
                    type="button"
                    onClick={loadProducts}
                >
                    {brand.copy.catalog.searchAction}
                </button>
            </div>
            <div className="flex h-full flex-wrap items-center justify-center gap-2">
                <input
                    className="mt-2.5 flex h-12 w-full max-w-[300px] self-center rounded border-0 text-center"
                    type="text"
                    placeholder={brand.copy.catalog.searchPlaceholder}
                    value={produto}
                    onChange={procure}
                />
                <input
                    aria-label="Category filter"
                    className="mt-2.5 flex h-12 w-full max-w-[180px] self-center rounded border-0 text-center"
                    type="text"
                    placeholder="Category"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                />
                <select
                    aria-label="Availability filter"
                    className="mt-2.5 h-12 w-full max-w-[180px] rounded border-0 text-center"
                    value={availability}
                    onChange={e => setAvailability(e.target.value)}
                >
                    <option value="">Any availability</option>
                    <option value="in_stock">In stock</option>
                    <option value="sold_out">Sold out only</option>
                </select>
                <select
                    aria-label="Sort products"
                    className="mt-2.5 h-12 w-full max-w-[180px] rounded border-0 text-center"
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                >
                    <option value="created_desc">Newest</option>
                    <option value="created_asc">Oldest</option>
                    <option value="name_asc">Name</option>
                    <option value="inventory_desc">Inventory</option>
                </select>
            </div>

            <div className="mx-auto max-w-[980px] px-0 py-[50px] text-center">
                {isLoading ? (
                    <div role="status" className="text-[32px] font-bold text-[#999]">
                        {brand.copy.catalog.loading}
                    </div>
                ) : error ? (
                    <div role="alert" className="text-[32px] font-bold text-[#999]">
                        {error}
                    </div>
                ) : newProducts.length > 0 ? (
                    <ul className="mt-[50px] grid list-none grid-cols-4 gap-[30px] max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
                        {newProducts.map(product => (
                            <li className="flex flex-col" key={product._id}>
                                <img className="max-w-full" src={product.image} alt={product.name} />
                                <div>
                                    <p className="overflow-hidden whitespace-nowrap">
                                        {product.name}
                                    </p>
                                    <p className="h-14 w-[223px] overflow-hidden text-ellipsis">
                                        {brand.copy.catalog.descriptionLabel}
                                    </p>
                                    <p className="h-14 w-[223px] overflow-hidden text-ellipsis">
                                        {product.description}
                                    </p>
                                    {product.category && (
                                        <p className="h-8 w-[223px] overflow-hidden text-ellipsis text-sm text-[#666]">
                                            {brand.copy.catalog.categoryLabel} {product.category}
                                        </p>
                                    )}
                                    {brand.features.inventory && product.inventory !== undefined && (
                                        <p className="h-8 w-[223px] overflow-hidden text-ellipsis font-bold text-[var(--brand-accent)]">
                                            {product.inventory > 0
                                                ? `${brand.copy.catalog.inventoryLabel} ${product.inventory}`
                                                : brand.copy.catalog.soldOutLabel}
                                        </p>
                                    )}
                                    {product.status && (
                                        <p className="h-8 w-[223px] overflow-hidden text-ellipsis text-sm font-bold text-[#666]">
                                            {brand.copy.catalog.statusLabel} {brand.copy.catalog.statusLabels[product.status]}
                                        </p>
                                    )}
                                    <div className="mt-2 flex w-[223px] flex-wrap justify-center gap-2">
                                        <Link
                                            className="rounded bg-[var(--brand-secondary)] px-3 py-2 text-sm font-bold text-white"
                                            to={appRoutes.productDetail(product._id)}
                                        >
                                            Details
                                        </Link>
                                        <button
                                            className="rounded border border-solid border-[#ddd] px-3 py-2 text-sm font-bold text-[#666]"
                                            type="button"
                                            onClick={() => setFavorites(toggleStoredId('favorites', product._id))}
                                        >
                                            {favorites.includes(product._id) ? 'Watching' : 'Watch'}
                                        </button>
                                        <button
                                            className="rounded border border-solid border-[#ddd] px-3 py-2 text-sm font-bold text-[#666]"
                                            type="button"
                                            onClick={() => setCart(toggleStoredId('cart', product._id))}
                                        >
                                            {cart.includes(product._id) ? 'In cart' : 'Cart'}
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-[32px] font-bold text-[#999]">
                        <h1>{brand.copy.catalog.empty}</h1>
                    </div>
                )}
            </div>
        </div>
    );
}
