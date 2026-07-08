import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdminDashboard from './AdminDashboard';
import Checkout from './Checkout';
import ProductDetail from './ProductDetail';
import SellerProfile from './SellerProfile';
import api from '../services/api';

vi.mock('../services/api', () => ({
    default: {
        get: vi.fn(),
    },
}));

const product = {
    _id: 'product-1',
    name: 'Coffee',
    description: 'Fresh beans',
    image: 'coffee.jpg',
    category: 'drinks',
    subcategory: 'beans',
    inventory: 3,
    status: 'active' as const,
    seller: 'seller-1',
    sellerProfile: {
        _id: 'seller-1',
        username: 'Seller',
        telephone: '123',
        email: 'seller@example.com',
        storeName: 'Seller store',
    },
};

function renderAt(route: string, path: string, element: React.ReactNode) {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path={path} element={element} />
            </Routes>
        </MemoryRouter>
    );
}

describe('marketplace pages', () => {
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        localStorage.clear();
        vi.mocked(api.get).mockReset();
    });

    it('loads product details and records watchlist, cart, review, and notifications', async () => {
        vi.mocked(api.get).mockResolvedValueOnce({ data: product });

        renderAt('/products/product-1', '/products/:productId', <ProductDetail />);

        expect(await screen.findByRole('heading', { name: 'Coffee' })).toBeInTheDocument();
        expect(screen.getByText('Contact: 123')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Watch' }));
        await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
        await userEvent.type(screen.getByLabelText('Review'), 'Great beans');
        await userEvent.click(screen.getByRole('button', { name: 'Add review' }));

        expect(localStorage.getItem('favorites')).toContain('product-1');
        expect(localStorage.getItem('cart')).toContain('product-1');
        expect(screen.getByText(/Great beans/)).toBeInTheDocument();
        expect(localStorage.getItem('notifications')).toContain('Review added for Coffee');
    });

    it('shows product detail load errors', async () => {
        vi.mocked(api.get).mockRejectedValueOnce(new Error('network error'));

        renderAt('/products/product-1', '/products/:productId', <ProductDetail />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load product.');
    });

    it('checks out cart items and stores order history', async () => {
        localStorage.setItem('cart', JSON.stringify(['product-1']));
        vi.mocked(api.get).mockResolvedValueOnce({ data: product });

        renderAt('/checkout', '/checkout', <Checkout />);

        expect(await screen.findByText('Coffee')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

        await waitFor(() => expect(localStorage.getItem('orders')).toContain('Coffee'));
        expect(localStorage.getItem('cart')).toBe('[]');
        expect(localStorage.getItem('notifications')).toContain('Order order-');
    });

    it('renders admin dashboard metrics and audit entries', async () => {
        localStorage.setItem('notifications', JSON.stringify(['Order created']));
        vi.mocked(api.get).mockResolvedValueOnce({
            data: [
                product,
                { ...product, _id: 'product-2', name: 'Tea', status: 'paused' },
            ],
        });

        renderAt('/admin', '/admin', <AdminDashboard />);

        expect(await screen.findByRole('heading', { name: 'Admin dashboard' })).toBeInTheDocument();
        expect(screen.getByText('Product Tea is paused in drinks')).toBeInTheDocument();
        expect(screen.getByText('Order created')).toBeInTheDocument();
    });

    it('loads seller profiles with product links', async () => {
        vi.mocked(api.get)
            .mockResolvedValueOnce({ data: product.sellerProfile })
            .mockResolvedValueOnce({ data: [product] });

        renderAt('/sellers/seller-1/profile', '/sellers/:sellerId/profile', <SellerProfile />);

        expect(await screen.findByRole('heading', { name: 'Seller store' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Coffee' })).toHaveAttribute('href', '/products/product-1');
    });

    it('shows seller profile load errors', async () => {
        vi.mocked(api.get).mockRejectedValueOnce(new Error('network error'));

        renderAt('/sellers/seller-1/profile', '/sellers/:sellerId/profile', <SellerProfile />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load seller profile.');
    });
});
