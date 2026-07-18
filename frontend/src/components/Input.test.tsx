import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '@/components/Input';

describe('Input', () => {
  it('applies themed field styles and preserves its accessible name', () => {
    render(<Input aria-label="Name" />);

    expect(screen.getByLabelText('Name')).toHaveClass(
      'rounded-control',
      'border-theme-border',
      'bg-surface',
      'text-content',
    );
  });
});
