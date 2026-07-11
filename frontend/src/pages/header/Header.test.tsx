import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Header from './index';
import { BrandProvider } from '../../brands/BrandProvider';
import { campusMarketBrand, type BrandConfig } from '../../brands';
import api from '../../services/api';

const navigate = vi.fn();

vi.mock('../../services/api', () => ({
    default: { post: vi.fn() },
}));

vi.mock('react-router', async () => {
    const actual = await vi.importActual<typeof import('react-router')>('react-router');

    return {
        ...actual,
        useNavigate: () => navigate,
    };
});

function renderHeader(route = '/', hideLoginAction = false, brand?: BrandConfig) {
    return render(
        <BrandProvider brand={brand}>
            <MemoryRouter initialEntries={[route]}>
                <Header hideLoginAction={hideLoginAction} />
            </MemoryRouter>
        </BrandProvider>
    );
}

describe('Header', () => {
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        localStorage.clear();
        navigate.mockReset();
        vi.mocked(api.post).mockReset();
        vi.mocked(api.post).mockResolvedValue({} as never);
    });

    it('shows the brand logo', () => {
        renderHeader();

        expect(screen.getByRole('img', { name: 'MercadoZetta logo' })).toBeInTheDocument();
    });

    it('renders a second brand config', () => {
        renderHeader('/', false, campusMarketBrand);

        expect(screen.getByRole('img', { name: 'CampusMarket logo' })).toBeInTheDocument();
        expect(document.title).toBe('CampusMarket');
    });

    it('shows login action for anonymous users', async () => {
        renderHeader();

        await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

        expect(navigate).toHaveBeenCalledWith('/login');
    });

    it('hides login action when requested', () => {
        renderHeader('/', true);

        expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument();
    });

    it('hides login action on the login page', () => {
        renderHeader('/login');

        expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument();
    });

    it('shows authenticated user data and logs out', async () => {
        localStorage.setItem('token', 'token-123');
        localStorage.setItem('user', JSON.stringify({
            username: 'Seller',
            email: 'seller@example.com',
            telephone: '123',
        }));

        renderHeader();

        expect(screen.getByText('Seller')).toBeInTheDocument();
        expect(screen.getByText('seller@example.com')).toBeInTheDocument();
        expect(screen.getByText('123')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

        expect(api.post).toHaveBeenCalledWith('/auth/logout');
        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
        expect(navigate).toHaveBeenCalledWith('/');
    });

    it('clears the local session even when server-side logout fails', async () => {
        localStorage.setItem('token', 'token-123');
        localStorage.setItem('user', JSON.stringify({ username: 'Seller' }));
        vi.mocked(api.post).mockRejectedValue(new Error('network error'));
        renderHeader();

        await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
        expect(navigate).toHaveBeenCalledWith('/');
    });

    it('clears invalid stored users and falls back to anonymous state', () => {
        localStorage.setItem('user', '{invalid-json');

        renderHeader();

        expect(localStorage.getItem('user')).toBeNull();
        expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    });
});
