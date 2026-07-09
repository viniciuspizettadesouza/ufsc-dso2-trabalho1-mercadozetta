import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';

import AddProduct from './AddProduct';
import api from '../services/api';

const navigate = vi.fn();

vi.mock('../services/api', () => ({
    default: {
        post: vi.fn(),
    },
}));

vi.mock('react-router', async () => {
    const actual = await vi.importActual<typeof import('react-router')>('react-router');

    return {
        ...actual,
        useNavigate: () => navigate,
    };
});

function renderAddProduct() {
    return render(
        <MemoryRouter>
            <AddProduct />
        </MemoryRouter>
    );
}

async function fillProductForm() {
    await userEvent.type(screen.getByPlaceholderText('Product name'), 'Coffee');
    await userEvent.type(screen.getByPlaceholderText('Product description'), 'Fresh beans');
    await userEvent.type(screen.getByPlaceholderText('Quantity'), '3');
    await userEvent.type(screen.getByPlaceholderText('Image URL'), 'coffee.jpg');
}

describe('AddProduct', () => {
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        localStorage.clear();
        navigate.mockReset();
        vi.mocked(api.post).mockReset();
    });

    it('shows an auth error when the user is not logged in', async () => {
        renderAddProduct();

        await fillProductForm();
        await userEvent.click(screen.getByRole('button', { name: 'Criar anúncio' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Entre para criar um anúncio.');
        expect(api.post).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('creates a product and redirects to the seller page', async () => {
        localStorage.setItem('token', 'token-123');
        localStorage.setItem('user', JSON.stringify({ _id: 'user-1' }));
        vi.mocked(api.post).mockResolvedValueOnce({ data: { newProduct: { _id: 'product-1' } } });

        renderAddProduct();

        await fillProductForm();
        await userEvent.click(screen.getByRole('button', { name: 'Criar anúncio' }));

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/products', {
                name: 'Coffee',
                description: 'Fresh beans',
                category: 'general',
                subcategory: '',
                inventory: 3,
                image: 'coffee.jpg',
                status: 'active',
            });
        });
        expect(navigate).toHaveBeenCalledWith('/sellers/user-1');
    });

    it('submits the selected product status', async () => {
        localStorage.setItem('token', 'token-123');
        localStorage.setItem('user', JSON.stringify({ _id: 'user-1' }));
        vi.mocked(api.post).mockResolvedValueOnce({ data: { newProduct: { _id: 'product-1' } } });

        renderAddProduct();

        await fillProductForm();
        await userEvent.selectOptions(screen.getByLabelText('Status do produto'), 'draft');
        await userEvent.click(screen.getByRole('button', { name: 'Criar anúncio' }));

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/products', expect.objectContaining({
                status: 'draft',
            }));
        });
    });

    it('shows a generic error when product creation fails without an API message', async () => {
        localStorage.setItem('token', 'token-123');
        localStorage.setItem('user', JSON.stringify({ _id: 'user-1' }));
        vi.mocked(api.post).mockRejectedValueOnce(new Error('network error'));

        renderAddProduct();

        await fillProductForm();
        await userEvent.click(screen.getByRole('button', { name: 'Criar anúncio' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível criar o anúncio. Tente novamente.');
        expect(navigate).not.toHaveBeenCalled();
    });

    it('handles corrupted stored users as logged out', async () => {
        localStorage.setItem('token', 'token-123');
        localStorage.setItem('user', '{');

        renderAddProduct();

        await fillProductForm();
        await userEvent.click(screen.getByRole('button', { name: 'Criar anúncio' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Entre para criar um anúncio.');
        expect(localStorage.getItem('user')).toBeNull();
    });

    it('shows the API error when product creation fails', async () => {
        localStorage.setItem('token', 'token-123');
        localStorage.setItem('user', JSON.stringify({ _id: 'user-1' }));

        const error = new AxiosError(
            'Product registration failed',
            undefined,
            undefined,
            undefined,
            {
                data: { error: 'Name, quantity and image are required' },
                status: 400,
                statusText: 'Bad Request',
                headers: {},
                config: { headers: new AxiosHeaders() },
            }
        );

        vi.mocked(api.post).mockRejectedValueOnce(error);

        renderAddProduct();

        await fillProductForm();
        await userEvent.click(screen.getByRole('button', { name: 'Criar anúncio' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Name, quantity and image are required');
        expect(navigate).not.toHaveBeenCalled();
    });
});
