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
        vi.unstubAllEnvs();
    });

    beforeEach(() => {
        localStorage.clear();
        apiGet.mockReset();
        apiGet.mockResolvedValue({ data: [] });
    });

    it('renders the home page for /', async () => {
        await renderAppAt('/');

        expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
        expect(await screen.findByText('No products found :(')).toBeInTheDocument();
    });

    it('renders the app with the sample CampusMarket tenant', async () => {
        vi.stubEnv('VITE_TENANT_ID', 'campus-market');

        await renderAppAt('/');

        expect(screen.getByRole('img', { name: 'CampusMarket logo' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Post offer' })).toBeInTheDocument();
        expect(await screen.findByText('No offers found :(')).toBeInTheDocument();
        expect(document.title).toBe('CampusMarket');
    });

    it('renders the login page for /login', async () => {
        await renderAppAt('/login');

        expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    });

    it('renders the register page for /register', async () => {
        await renderAppAt('/register');

        expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Phone')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    });

    it('renders the product creation page for /products/new', async () => {
        await renderAppAt('/products/new');

        expect(screen.getByPlaceholderText('Product name')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Image URL')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create listing' })).toBeInTheDocument();
    });

    it('renders the seller products page for /sellers/:sellerId', async () => {
        await renderAppAt('/sellers/seller-1');

        expect(await screen.findByText('No products found :(')).toBeInTheDocument();
        expect(apiGet).toHaveBeenCalledWith('/users/seller-1/products');
    });
});
