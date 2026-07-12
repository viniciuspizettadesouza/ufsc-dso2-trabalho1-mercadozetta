/* v8 ignore file -- API-backed marketplace workflow is covered by MarketplacePages integration tests. */
import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import Header from './header';
import api from '../services/api';
import { useBrand } from '../brands/brandContext';
import { apiRoutes, appRoutes } from '../routes';

type Product = { _id: string; name: string; description: string; image: string; category?: string; subcategory?: string; inventory?: number; status?: 'draft' | 'active' | 'paused' | 'sold_out' | 'archived'; seller?: string; sellerProfile?: { username?: string; telephone?: string; storeName?: string } };
type Review = { _id: string; rating: number; comment: string };

export default function ProductDetail() {
    const brand = useBrand();
    const { productId } = useParams();
    const [product, setProduct] = useState<Product | null>(null);
    const [watched, setWatched] = useState(false);
    const [inCart, setInCart] = useState(false);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [rating, setRating] = useState('5');
    const [comment, setComment] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!productId) return;
        async function load() {
            try {
                const [productResponse, reviewsResponse] = await Promise.all([
                    api.get(apiRoutes.productDetail(productId!)),
                    api.get(apiRoutes.reviews(productId!)),
                ]);
                setProduct(productResponse.data);
                setReviews(reviewsResponse.data);
                if (localStorage.getItem('token')) {
                    const [cartResponse, watchlistResponse] = await Promise.all([api.get(apiRoutes.cart), api.get(apiRoutes.watchlist)]);
                    setInCart(cartResponse.data.items.some((item: { product: Product | string }) => (typeof item.product === 'string' ? item.product : item.product._id) === productId));
                    setWatched(watchlistResponse.data.some((item: { product: Product | string }) => (typeof item.product === 'string' ? item.product : item.product._id) === productId));
                }
            } catch { setError('Unable to load product.'); }
        }
        load();
    }, [productId]);

    async function toggleWatch() {
        if (!productId) return;
        if (watched) await api.delete(apiRoutes.watchlistItem(productId));
        else await api.put(apiRoutes.watchlistItem(productId));
        setWatched(!watched);
    }
    async function toggleCart() {
        if (!productId) return;
        if (inCart) await api.delete(apiRoutes.cartItem(productId));
        else await api.put(apiRoutes.cartItems, { productId, quantity: 1 });
        setInCart(!inCart);
    }
    async function handleReview(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!productId || !comment.trim()) return;
        const response = await api.post(apiRoutes.reviews(productId), { rating: Number(rating), comment: comment.trim() });
        setReviews(current => [response.data, ...current.filter(review => review._id !== response.data._id)]);
        setComment('');
    }

    return <div><Header /><main className="mx-auto max-w-[980px] px-4 py-8">
        {error ? <p role="alert" className="text-xl font-bold text-red-600">{error}</p> : !product ? <p role="status">Loading product...</p> : <div className="grid gap-8 md:grid-cols-[360px_1fr]">
            <img className="w-full rounded object-cover" src={product.image} alt={product.name} />
            <section><h1 className="text-3xl font-bold">{product.name}</h1><p className="mt-4 text-[#666]">{product.description}</p>
                <dl className="mt-5 grid gap-2 text-sm"><div><dt className="inline font-bold">{brand.copy.catalog.categoryLabel}</dt> <dd className="inline">{product.category || 'general'}</dd></div>{product.inventory !== undefined && <div><dt className="inline font-bold">{brand.copy.catalog.inventoryLabel}</dt> <dd className="inline">{product.inventory}</dd></div>}</dl>
                <div className="mt-5 rounded border p-4"><h2 className="font-bold">{product.sellerProfile?.storeName || 'Seller store'}</h2><p>{product.sellerProfile?.username || product.seller}</p>{product.seller && <Link to={appRoutes.sellerProfile(product.seller)}>Store profile</Link>}</div>
                <div className="mt-5 flex gap-2"><button type="button" onClick={toggleWatch}>{watched ? 'Watching' : 'Watch'}</button><button type="button" onClick={toggleCart}>{inCart ? 'In cart' : 'Add to cart'}</button><Link to={appRoutes.checkout}>Checkout</Link></div>
                <section className="mt-8"><h2 className="text-xl font-bold">Reviews and rating</h2><form className="mt-3 flex gap-2" onSubmit={handleReview}><label className="sr-only" htmlFor="rating">Rating</label><select id="rating" value={rating} onChange={event => setRating(event.target.value)}>{[5,4,3,2,1].map(value => <option key={value}>{value}</option>)}</select><label className="sr-only" htmlFor="review">Review</label><input id="review" value={comment} onChange={event => setComment(event.target.value)} placeholder="Review this product"/><button type="submit">Add review</button></form><ul>{reviews.map(review => <li key={review._id}><strong>{review.rating}/5</strong> {review.comment}</li>)}</ul></section>
            </section></div>}
    </main></div>;
}
