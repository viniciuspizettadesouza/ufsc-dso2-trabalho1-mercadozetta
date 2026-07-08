import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Index from './Index';
import api from '../services/api';

const navigate = vi.fn();

vi.mock('../services/api', () => ({
    default: {
        get: vi.fn(),
    },
}));

vi.mock('react-router', async () => {
    const actual = await vi.importActual<typeof import('react-router')>('react-router');

    return {
        ...actual,
        useNavigate: () => navigate,
    };
});

function renderIndex() {
    return render(
        <MemoryRouter>
            <Index />
        </MemoryRouter>
    );
}

describe('Index', () => {
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        localStorage.clear();
        navigate.mockReset();
        vi.mocked(api.get).mockResolvedValue({ data: [] });
    });

    it('renders the main product experience', async () => {
        renderIndex();

        expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Inserir Produtos' })).toBeInTheDocument();
        expect(await screen.findByText('Nenhum produto encontrado :(')).toBeInTheDocument();
    });

    it('navigates to account creation', async () => {
        renderIndex();

        await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

        expect(navigate).toHaveBeenCalledWith('/register');
    });

    it('navigates to product creation', async () => {
        renderIndex();

        await userEvent.click(screen.getByRole('button', { name: 'Inserir Produtos' }));

        expect(navigate).toHaveBeenCalledWith('/products/new');
    });
});
