import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();

vi.mock('./services/api', () => ({
    default: {
        get: apiGet,
        post: vi.fn(),
    },
}));

async function renderAppAt(path: string) {
    window.history.pushState({}, '', path);
    const { default: App } = await import('./App');

    return render(<App />);
}

describe('App', () => {
    afterEach(() => {
        cleanup();
        vi.resetModules();
    });

    beforeEach(() => {
        localStorage.clear();
        apiGet.mockReset();
        apiGet.mockResolvedValue({ data: [] });
    });

    it('renders the home page for /', async () => {
        await renderAppAt('/');

        expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument();
        expect(await screen.findByText('Nenhum produto encontrado :(')).toBeInTheDocument();
    });

    it('renders the login page for /login', async () => {
        await renderAppAt('/login');

        expect(screen.getByPlaceholderText('E-mail')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Senha')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    });

    it('renders the register page for /register', async () => {
        await renderAppAt('/register');

        expect(screen.getByPlaceholderText('Nome')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Telefone')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument();
    });

    it('renders the product creation page for /products/new', async () => {
        await renderAppAt('/products/new');

        expect(screen.getByPlaceholderText('Nome do Produto')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('URL da Imagem')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Inserir Anúncio' })).toBeInTheDocument();
    });

    it('renders the seller products page for /sellers/:sellerId', async () => {
        await renderAppAt('/sellers/seller-1');

        expect(await screen.findByText('Nenhum produto encontrado :(')).toBeInTheDocument();
        expect(apiGet).toHaveBeenCalledWith('/users/seller-1/products');
    });
});
