import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from '@/components/Button';

describe('Button', () => {
  it('applies explicit variants without hiding native attributes', () => {
    render(
      <>
        <Button variant="primary">Save</Button>
        <Button disabled>Cancel</Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
      'border-action',
      'bg-action',
      'text-on-action',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass(
      'border-theme-border',
      'bg-surface',
      'text-content',
    );
  });
});
