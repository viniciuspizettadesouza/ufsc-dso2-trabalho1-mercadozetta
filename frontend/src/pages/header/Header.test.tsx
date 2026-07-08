import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Header from './index';

const navigate = vi.fn();

vi.mock('react-router', async () => {
    const actual = await vi.importActual<typeof import('react-router')>('react-router');

    return {
        ...actual,
        useNavigate: () => navigate,
    };
});

function renderHeader(route = '/', hideLoginAction = false) {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Header hideLoginAction={hideLoginAction} />
        </MemoryRouter>
    );
}

describe('Header', () => {
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        localStorage.clear();
        navigate.mockReset();
    });

    it('shows the brand logo', () => {
        renderHeader();

        expect(screen.getByRole('img', { name: 'logo' })).toBeInTheDocument();
    });

    it('shows login action for anonymous users', async () => {
        renderHeader();

        await userEvent.click(screen.getByRole('button', { name: 'Login' }));

        expect(navigate).toHaveBeenCalledWith('/login');
    });

    it('hides login action when requested', () => {
        renderHeader('/', true);

        expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument();
    });

    it('hides login action on the login page', () => {
        renderHeader('/login');

        expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument();
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

        await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
        expect(navigate).toHaveBeenCalledWith('/');
    });

    it('clears invalid stored users and falls back to anonymous state', () => {
        localStorage.setItem('user', '{invalid-json');

        renderHeader();

        expect(localStorage.getItem('user')).toBeNull();
        expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    });
});
