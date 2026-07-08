import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Products from './Products';
import api from '../services/api';

vi.mock('../services/api', () => ({
    default: {
        get: vi.fn(),
    },
}));

const products = [
    {
        _id: 'product-1',
        name: 'Coffee',
        description: 'Fresh beans',
        image: 'coffee.jpg',
        inventory: 3,
        status: 'active' as const,
    },
    {
        _id: 'product-2',
        name: 'Tea',
        description: 'Green leaves',
        image: 'tea.jpg',
        inventory: 0,
        status: 'paused' as const,
    },
];

function renderProducts(route = '/', path = '/') {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path={path} element={<Products />} />
            </Routes>
        </MemoryRouter>
    );
}

describe('Products', () => {
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        localStorage.clear();
        vi.mocked(api.get).mockReset();
    });

    it('loads all products on the home page', async () => {
        vi.mocked(api.get).mockResolvedValueOnce({ data: products });

        renderProducts();

        expect(screen.getByRole('status')).toHaveTextContent('Loading products...');
        expect(await screen.findByText('Coffee')).toBeInTheDocument();
        expect(screen.getByText('Tea')).toBeInTheDocument();
        expect(screen.getByText('Available: 3')).toBeInTheDocument();
        expect(screen.getByText('Sold out')).toBeInTheDocument();
        expect(screen.getByText('Status: Active')).toBeInTheDocument();
        expect(screen.getByText('Status: Paused')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('/products');
    });

    it('loads seller products on seller pages', async () => {
        vi.mocked(api.get).mockResolvedValueOnce({ data: [products[0]] });

        renderProducts('/sellers/seller-1', '/sellers/:sellerId');

        expect(await screen.findByText('Coffee')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('/users/seller-1/products');
    });

    it('shows API failure state', async () => {
        vi.mocked(api.get).mockRejectedValueOnce(new Error('network error'));

        renderProducts();

        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load products.');
    });

    it('filters products case-insensitively and handles no results', async () => {
        vi.mocked(api.get).mockResolvedValueOnce({ data: products });

        renderProducts();

        await screen.findByText('Coffee');
        await userEvent.type(screen.getByPlaceholderText('Search for a product'), 'TE');

        expect(screen.getByText('Tea')).toBeInTheDocument();
        expect(screen.queryByText('Coffee')).not.toBeInTheDocument();

        await userEvent.clear(screen.getByPlaceholderText('Search for a product'));
        expect(screen.getByText('Coffee')).toBeInTheDocument();

        await userEvent.type(screen.getByPlaceholderText('Search for a product'), 'zz');
        expect(screen.getByText('No products found :(')).toBeInTheDocument();
    });

    it('requests backend filters with query params', async () => {
        vi.mocked(api.get)
            .mockResolvedValueOnce({ data: products })
            .mockResolvedValueOnce({ data: [products[1]] });

        renderProducts();

        await screen.findByText('Coffee');
        await userEvent.type(screen.getByPlaceholderText('Search for a product'), 'tea');
        await userEvent.type(screen.getByLabelText('Category filter'), 'drinks');
        await userEvent.selectOptions(screen.getByLabelText('Availability filter'), 'sold_out');
        await userEvent.selectOptions(screen.getByLabelText('Sort products'), 'name_asc');
        await userEvent.click(screen.getByRole('button', { name: 'Search products' }));

        expect(api.get).toHaveBeenLastCalledWith('/products?q=tea&category=drinks&availability=sold_out&sort=name_asc');
    });

    it('shows backend filter failures', async () => {
        vi.mocked(api.get)
            .mockResolvedValueOnce({ data: products })
            .mockRejectedValueOnce(new Error('network error'));

        renderProducts();

        await screen.findByText('Coffee');
        await userEvent.click(screen.getByRole('button', { name: 'Search products' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load products.');
    });

    it('toggles watchlist and cart state from storage', async () => {
        localStorage.setItem('favorites', JSON.stringify(['product-1']));
        localStorage.setItem('cart', JSON.stringify(['product-1']));
        vi.mocked(api.get).mockResolvedValueOnce({ data: products });

        renderProducts();

        expect(await screen.findByRole('button', { name: 'Watching' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'In cart' })).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Watching' }));
        await userEvent.click(screen.getByRole('button', { name: 'In cart' }));

        expect(localStorage.getItem('favorites')).toBe('[]');
        expect(localStorage.getItem('cart')).toBe('[]');
    });

    it('handles invalid stored marketplace state', async () => {
        localStorage.setItem('favorites', '{');
        localStorage.setItem('cart', '{');
        vi.mocked(api.get).mockResolvedValueOnce({ data: products });

        renderProducts();

        expect(await screen.findAllByRole('button', { name: 'Watch' })).toHaveLength(2);
        expect(screen.getAllByRole('button', { name: 'Cart' })).toHaveLength(2);
    });

    it('renders image alt text from product name', async () => {
        vi.mocked(api.get).mockResolvedValueOnce({ data: products });

        renderProducts();

        expect(await screen.findByRole('img', { name: 'Coffee' })).toHaveAttribute('src', 'coffee.jpg');
    });
});
