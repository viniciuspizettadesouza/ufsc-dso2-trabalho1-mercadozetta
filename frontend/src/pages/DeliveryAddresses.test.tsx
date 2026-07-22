import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthTestProvider } from '@/test/AuthTestProvider';
import { ServerStateProvider } from '@/serverState/queryClient';
import DeliveryAddresses from '@/pages/DeliveryAddresses';
import api from '@/services/api';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const address = {
  _id: '507f191e-810c-4197-9de8-60ea00000001',
  tenantId: 'campus-market',
  userId: 'buyer-1',
  label: 'Home',
  recipientName: 'Buyer',
  line1: 'Rua do Mercado 1',
  line2: null,
  city: 'Lisboa',
  region: 'Lisboa',
  postalCode: '1000-001',
  countryCode: 'PT',
  telephone: '+351210000000',
  isDefault: true,
  createdAt: '2026-07-22T10:00:00.000Z',
  updatedAt: '2026-07-22T10:00:00.000Z',
};
const secondaryAddress = {
  ...address,
  _id: '507f191e-810c-4197-9de8-60ea00000002',
  label: 'Office',
  line2: 'Floor 2',
  region: null,
  isDefault: false,
};

function renderPage() {
  return render(
    <ServerStateProvider>
      <AuthTestProvider user={{ _id: 'buyer-1', username: 'Buyer' }}>
        <MemoryRouter>
          <DeliveryAddresses />
        </MemoryRouter>
      </AuthTestProvider>
    </ServerStateProvider>,
  );
}

describe('DeliveryAddresses', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: url === '/account/addresses' ? [address] : { count: 0 },
    }));
    vi.mocked(api.post).mockResolvedValue({ data: address });
    vi.mocked(api.put).mockResolvedValue({ data: address });
    vi.mocked(api.delete).mockResolvedValue({});
  });

  it('creates, edits, and explicitly deletes saved delivery addresses', async () => {
    renderPage();

    expect(await screen.findByText('Home (default)')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Address label'), 'Office');
    await userEvent.type(screen.getByLabelText('Recipient name'), 'Buyer');
    await userEvent.type(screen.getByLabelText('Address line 1'), 'Rua Nova 2');
    await userEvent.type(
      screen.getByLabelText('Address line 2 (optional)'),
      'Floor 3',
    );
    await userEvent.type(screen.getByLabelText('City'), 'Lisboa');
    await userEvent.type(
      screen.getByLabelText('Region/state (optional)'),
      'Lisboa',
    );
    await userEvent.type(screen.getByLabelText('Postal code'), '1000-002');
    await userEvent.clear(screen.getByLabelText('Country code'));
    await userEvent.type(screen.getByLabelText('Country code'), 'PT');
    await userEvent.type(screen.getByLabelText('Telephone'), '+351210000001');
    await userEvent.click(screen.getByLabelText('Use as default address'));
    await userEvent.click(screen.getByRole('button', { name: 'Add address' }));

    expect(api.post).toHaveBeenCalledWith(
      '/account/addresses',
      expect.objectContaining({
        label: 'Office',
        line2: 'Floor 3',
        region: 'Lisboa',
        postalCode: '1000-002',
        isDefault: true,
      }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Delivery address added.',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Edit Home' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Update address' }),
    );
    expect(api.put).toHaveBeenCalledWith(
      `/account/addresses/${address._id}`,
      expect.objectContaining({ label: 'Home', isDefault: true }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete Home' }));
    expect(api.delete).toHaveBeenCalledWith(
      `/account/addresses/${address._id}`,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Default address deleted.',
      ),
    );
  });

  it('shows address loading and API errors accessibly', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network error'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load delivery addresses.',
    );
  });

  it('shows an empty address book', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: url === '/account/addresses' ? [] : { count: 0 },
    }));
    renderPage();

    expect(
      await screen.findByText('No delivery addresses saved.'),
    ).toBeInTheDocument();
  });

  it('cancels editing and deletes a non-default address', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: url === '/account/addresses' ? [secondaryAddress] : { count: 0 },
    }));
    renderPage();

    await screen.findByText('Office');
    expect(screen.getByText(/Floor 2/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Office' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel edit' }));
    expect(
      screen.getByRole('heading', { name: 'Add a delivery address' }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Delete Office' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Delivery address deleted.',
      ),
    );
  });

  it('preserves editing state when update and deletion fail', async () => {
    vi.mocked(api.put).mockRejectedValue(new Error('network error'));
    vi.mocked(api.delete).mockRejectedValue(new Error('network error'));
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Home' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Update address' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to save delivery address.',
    );
    expect(
      screen.getByRole('heading', { name: 'Edit Home' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete Home' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to delete delivery address.',
    );
  });
});
