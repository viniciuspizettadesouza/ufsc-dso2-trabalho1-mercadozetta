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
    },
    {
        _id: 'product-2',
        name: 'Tea',
        description: 'Green leaves',
        image: 'tea.jpg',
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
        vi.mocked(api.get).mockReset();
    });

    it('loads all products on the home page', async () => {
        vi.mocked(api.get).mockResolvedValueOnce({ data: products });

        renderProducts();

        expect(screen.getByRole('status')).toHaveTextContent('Loading products...');
        expect(await screen.findByText('Coffee')).toBeInTheDocument();
        expect(screen.getByText('Tea')).toBeInTheDocument();
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

    it('renders image alt text from product name', async () => {
        vi.mocked(api.get).mockResolvedValueOnce({ data: products });

        renderProducts();

        expect(await screen.findByRole('img', { name: 'Coffee' })).toHaveAttribute('src', 'coffee.jpg');
    });
});
