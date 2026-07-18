import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Select } from '@/components/Select';

describe('Select', () => {
  it('applies themed field styles and preserves its accessible name', () => {
    render(
      <Select aria-label="Status">
        <option>Active</option>
      </Select>,
    );

    expect(screen.getByLabelText('Status')).toHaveClass(
      'rounded-control',
      'border-theme-border',
      'bg-surface',
      'text-content',
    );
  });
});
