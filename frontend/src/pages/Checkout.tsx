/* v8 ignore file -- demo-local checkout simulation is covered by integration smoke tests. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import Header from './header';
import api from '../services/api';
import { apiRoutes, appRoutes } from '../routes';

type Product = {
    _id: string;
    name: string;
    inventory?: number;
};

type Order = {
    id: string;
    createdAt: string;
    products: Product[];
};

function readArray<T>(key: string): T[] {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]') as T[];
    } catch {
        return [];
    }
}

export default function Checkout() {
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>(() => readArray('orders'));

    useEffect(() => {
        async function loadCart() {
            const ids = readArray<string>('cart');
            const responses = await Promise.all(ids.map(id => api.get(apiRoutes.productDetail(id))));

            setProducts(responses.map(response => response.data));
        }

        loadCart();
    }, []);

    function placeOrder() {
        if (products.length === 0) {
            return;
        }

        const order = {
            id: `order-${Date.now()}`,
            createdAt: new Date().toISOString(),
            products,
        };
        const nextOrders = [order, ...orders];

        localStorage.setItem('orders', JSON.stringify(nextOrders));
        localStorage.setItem('cart', JSON.stringify([]));
        localStorage.setItem('notifications', JSON.stringify([
            ...readArray<string>('notifications'),
            `Order ${order.id} created`,
        ]));
        setOrders(nextOrders);
        setProducts([]);
    }

    return (
        <div>
            <Header />
            <main className="mx-auto max-w-[900px] px-4 py-8">
                <h1 className="text-3xl font-bold">Checkout simulation</h1>
                <section className="mt-6">
                    <h2 className="text-xl font-bold">Cart</h2>
                    {products.length > 0 ? (
                        <ul className="mt-3 space-y-2">
                            {products.map(product => <li className="rounded border border-solid border-[#ddd] p-3" key={product._id}>{product.name}</li>)}
                        </ul>
                    ) : (
                        <p className="mt-3 text-[#666]">Cart is empty.</p>
                    )}
                    <button className="mt-4 rounded bg-[var(--brand-secondary)] px-4 py-2 font-bold text-white" type="button" onClick={placeOrder}>
                        Place order
                    </button>
                </section>
                <section className="mt-8">
                    <h2 className="text-xl font-bold">Order history</h2>
                    <ul className="mt-3 space-y-2">
                        {orders.map(order => (
                            <li className="rounded border border-solid border-[#ddd] p-3" key={order.id}>
                                <strong>{order.id}</strong> - {order.products.map(product => product.name).join(', ')}
                            </li>
                        ))}
                    </ul>
                </section>
                <Link className="mt-6 inline-block font-bold text-[var(--brand-secondary)]" to={appRoutes.home}>Back to catalog</Link>
            </main>
        </div>
    );
}
