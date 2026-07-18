import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Index from '@/pages/Index';
import api from '@/services/api';
import { ServerStateProvider } from '@/serverState/queryClient';
import { paginatedResponse } from '@/test/paginatedResponse';

const navigate = vi.fn();

vi.mock('@/services/api', () => ({
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
    <ServerStateProvider>
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    </ServerStateProvider>,
  );
}

describe('Index', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(api.get).mockResolvedValue({ data: paginatedResponse([]) });
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
