import { cleanup, render, screen } from '@testing-library/react';
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
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

function renderIndex() {
  return render(
    <MemoryRouter>
      <Index />
    </MemoryRouter>,
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

  it('renders the main marketplace experience', async () => {
    renderIndex();

    expect(
      screen.getByRole('heading', { name: 'Encontre ofertas do marketplace' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(
      screen.getByRole('link', { name: 'Anunciar produto' }),
    ).toHaveAttribute('href', '/products/new');
    expect(
      await screen.findByText('Nenhum produto encontrado'),
    ).toBeInTheDocument();
  });
});
