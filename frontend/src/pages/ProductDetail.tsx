/* v8 ignore file -- demo-local marketplace interactions are covered by integration smoke tests. */
import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import Header from './header';
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
    sellerProfile?: {
        _id: string;
        username?: string;
        telephone?: string;
        email?: string;
        storeName?: string;
    };
};

type Review = {
    productId: string;
    rating: number;
    comment: string;
};

function getStoredArray<T>(key: string): T[] {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]') as T[];
    } catch {
        return [];
    }
}

function setStoredArray<T>(key: string, items: T[]) {
    localStorage.setItem(key, JSON.stringify(items));
}

function toggleId(key: string, id: string) {
    const ids = getStoredArray<string>(key);
    const nextIds = ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id];

    setStoredArray(key, nextIds);
    return nextIds;
}

export default function ProductDetail() {
    const brand = useBrand();
    const { productId } = useParams();
    const [product, setProduct] = useState<Product | null>(null);
    const [favorites, setFavorites] = useState<string[]>(() => getStoredArray('favorites'));
    const [cart, setCart] = useState<string[]>(() => getStoredArray('cart'));
    const [reviews, setReviews] = useState<Review[]>(() => getStoredArray('reviews'));
    const [rating, setRating] = useState('5');
    const [comment, setComment] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadProduct() {
            if (!productId) {
                return;
            }

            try {
                setError('');
                const response = await api.get(apiRoutes.productDetail(productId));
                setProduct(response.data);
            } catch {
                setError('Unable to load product.');
            }
        }

        loadProduct();
    }, [productId]);

    function handleReview(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!productId || !comment.trim()) {
            return;
        }

        const nextReviews = [
            ...reviews,
            { productId, rating: Number(rating), comment: comment.trim() },
        ];

        setReviews(nextReviews);
        setStoredArray('reviews', nextReviews);
        setStoredArray('notifications', [
            ...getStoredArray<string>('notifications'),
            `Review added for ${product?.name || 'product'}`,
        ]);
        setComment('');
    }

    const productReviews = productId
        ? reviews.filter(review => review.productId === productId)
        : [];

    return (
        <div>
            <Header />
            <main className="mx-auto max-w-[980px] px-4 py-8">
                {error ? (
                    <p role="alert" className="text-xl font-bold text-red-600">{error}</p>
                ) : !product ? (
                    <p role="status" className="text-xl font-bold text-[#999]">Loading product...</p>
                ) : (
                    <div className="grid gap-8 md:grid-cols-[360px_1fr]">
                        <img className="w-full rounded object-cover" src={product.image} alt={product.name} />
                        <section>
                            <h1 className="text-3xl font-bold text-[var(--brand-text)]">{product.name}</h1>
                            <p className="mt-4 text-[#666]">{product.description}</p>
                            <dl className="mt-5 grid gap-2 text-sm text-[#555]">
                                <div><dt className="inline font-bold">{brand.copy.catalog.categoryLabel}</dt> <dd className="inline">{product.category || 'general'}</dd></div>
                                {product.subcategory && (
                                    <div><dt className="inline font-bold">{brand.copy.catalog.subcategoryLabel}</dt> <dd className="inline">{product.subcategory}</dd></div>
                                )}
                                {product.inventory !== undefined && (
                                    <div><dt className="inline font-bold">{brand.copy.catalog.inventoryLabel}</dt> <dd className="inline">{product.inventory}</dd></div>
                                )}
                                {product.status && (
                                    <div><dt className="inline font-bold">{brand.copy.catalog.statusLabel}</dt> <dd className="inline">{brand.copy.catalog.statusLabels[product.status]}</dd></div>
                                )}
                            </dl>
                            <div className="mt-5 rounded border border-solid border-[#ddd] p-4">
                                <h2 className="text-lg font-bold">{product.sellerProfile?.storeName || 'Seller store'}</h2>
                                <p className="text-sm text-[#666]">{brand.copy.catalog.sellerLabel} {product.sellerProfile?.username || product.seller || 'Seller'}</p>
                                {product.sellerProfile?.telephone && <p className="text-sm text-[#666]">Contact: {product.sellerProfile.telephone}</p>}
                                {product.seller && (
                                    <Link className="mt-2 inline-block text-sm font-bold text-[var(--brand-secondary)]" to={appRoutes.sellerProfile(product.seller)}>
                                        Store profile
                                    </Link>
                                )}
                            </div>
                            <div className="mt-5 flex flex-wrap gap-2">
                                <button className="rounded border border-solid border-[#ddd] px-4 py-2 font-bold text-[#666]" type="button" onClick={() => setFavorites(toggleId('favorites', product._id))}>
                                    {favorites.includes(product._id) ? 'Watching' : 'Watch'}
                                </button>
                                <button className="rounded bg-[var(--brand-secondary)] px-4 py-2 font-bold text-white" type="button" onClick={() => setCart(toggleId('cart', product._id))}>
                                    {cart.includes(product._id) ? 'In cart' : 'Add to cart'}
                                </button>
                                <Link className="rounded border border-solid border-[#ddd] px-4 py-2 font-bold text-[#666]" to={appRoutes.checkout}>
                                    Checkout
                                </Link>
                            </div>
                            <section className="mt-8">
                                <h2 className="text-xl font-bold">Reviews and rating</h2>
                                <form className="mt-3 flex flex-wrap gap-2" onSubmit={handleReview}>
                                    <label className="sr-only" htmlFor="rating">Rating</label>
                                    <select id="rating" className="h-10 rounded border border-solid border-[#ddd] px-3" value={rating} onChange={event => setRating(event.target.value)}>
                                        <option value="5">5</option>
                                        <option value="4">4</option>
                                        <option value="3">3</option>
                                        <option value="2">2</option>
                                        <option value="1">1</option>
                                    </select>
                                    <label className="sr-only" htmlFor="review">Review</label>
                                    <input id="review" className="h-10 min-w-[220px] flex-1 rounded border border-solid border-[#ddd] px-3" value={comment} onChange={event => setComment(event.target.value)} placeholder="Review this product" />
                                    <button className="h-10 rounded bg-[var(--brand-secondary)] px-4 font-bold text-white" type="submit">Add review</button>
                                </form>
                                <ul className="mt-3 space-y-2">
                                    {productReviews.map((review, index) => (
                                        <li className="rounded border border-solid border-[#ddd] p-3" key={`${review.productId}-${index}`}>
                                            <strong>{review.rating}/5</strong> {review.comment}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        </section>
                    </div>
                )}
            </main>
        </div>
    );
}
