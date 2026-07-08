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
    await userEvent.type(screen.getByPlaceholderText('Nome do Produto'), 'Coffee');
    await userEvent.type(screen.getByPlaceholderText('Descrição do Produto'), 'Fresh beans');
    await userEvent.type(screen.getByPlaceholderText('Quantidade'), '3');
    await userEvent.type(screen.getByPlaceholderText('URL da Imagem'), 'coffee.jpg');
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
        await userEvent.click(screen.getByRole('button', { name: 'Inserir Anúncio' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Faça login para inserir um anúncio.');
        expect(api.post).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('creates a product and redirects to the seller page', async () => {
        localStorage.setItem('token', 'token-123');
        localStorage.setItem('user', JSON.stringify({ _id: 'user-1' }));
        vi.mocked(api.post).mockResolvedValueOnce({ data: { newProduct: { _id: 'product-1' } } });

        renderAddProduct();

        await fillProductForm();
        await userEvent.click(screen.getByRole('button', { name: 'Inserir Anúncio' }));

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/products', {
                name: 'Coffee',
                description: 'Fresh beans',
                quant: '3',
                image: 'coffee.jpg',
            });
        });
        expect(navigate).toHaveBeenCalledWith('/sellers/user-1');
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
        await userEvent.click(screen.getByRole('button', { name: 'Inserir Anúncio' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Name, quantity and image are required');
        expect(navigate).not.toHaveBeenCalled();
    });
});
