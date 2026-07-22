import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AccountRequestForm } from '@/components/AccountRequestForm';
import { ServerStateProvider } from '@/serverState/queryClient';
import { AuthTestProvider } from '@/test/AuthTestProvider';

describe('AccountRequestForm', () => {
  it('shows the supplied email and pending state', () => {
    render(
      <ServerStateProvider>
        <AuthTestProvider user={null}>
          <MemoryRouter>
            <AccountRequestForm
              title="Verify email"
              description="Request a link."
              initialEmail="buyer@example.com"
              pending
              submitLabel="Send verification link"
              onSubmit={vi.fn()}
            />
          </MemoryRouter>
        </AuthTestProvider>
      </ServerStateProvider>,
    );

    expect(screen.getByLabelText('Email')).toHaveValue('buyer@example.com');
    expect(
      screen.getByRole('button', { name: 'Sending request...' }),
    ).toBeDisabled();
  });
});
