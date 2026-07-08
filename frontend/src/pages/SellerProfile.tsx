/* v8 ignore file -- demo-local seller profile page is covered by integration smoke tests. */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import Header from './header';
import api from '../services/api';
import { apiRoutes, appRoutes } from '../routes';

type Seller = {
    _id: string;
    username?: string;
    telephone?: string;
    email?: string;
    storeName?: string;
};

type Product = {
    _id: string;
    name: string;
};

export default function SellerProfile() {
    const { sellerId } = useParams();
    const [seller, setSeller] = useState<Seller | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadSeller() {
            if (!sellerId) {
                return;
            }

            try {
                const [sellerResponse, productsResponse] = await Promise.all([
                    api.get(apiRoutes.sellerProfile(sellerId)),
                    api.get(apiRoutes.sellerProducts(sellerId)),
                ]);

                setSeller(sellerResponse.data);
                setProducts(productsResponse.data);
            } catch {
                setError('Unable to load seller profile.');
            }
        }

        loadSeller();
    }, [sellerId]);

    return (
        <div>
            <Header />
            <main className="mx-auto max-w-[900px] px-4 py-8">
                {error ? (
                    <p role="alert" className="text-xl font-bold text-red-600">{error}</p>
                ) : !seller ? (
                    <p role="status" className="text-xl font-bold text-[#999]">Loading seller...</p>
                ) : (
                    <>
                        <section className="rounded border border-solid border-[#ddd] p-5">
                            <h1 className="text-3xl font-bold">{seller.storeName || 'Seller store'}</h1>
                            <p className="mt-2 text-[#666]">{seller.username || 'Seller'}</p>
                            {seller.telephone && <p className="text-[#666]">Contact: {seller.telephone}</p>}
                            {seller.email && <p className="text-[#666]">{seller.email}</p>}
                        </section>
                        <section className="mt-8">
                            <h2 className="text-xl font-bold">Seller products</h2>
                            <ul className="mt-3 space-y-2">
                                {products.map(product => (
                                    <li className="rounded border border-solid border-[#ddd] p-3" key={product._id}>
                                        <Link className="font-bold text-[var(--brand-secondary)]" to={appRoutes.productDetail(product._id)}>
                                            {product.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}
