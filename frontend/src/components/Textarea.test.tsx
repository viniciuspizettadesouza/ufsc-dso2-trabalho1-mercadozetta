import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Textarea } from '@/components/Textarea';

describe('Textarea', () => {
  it('applies themed field styles and preserves its accessible name', () => {
    render(<Textarea aria-label="Description" />);

    expect(screen.getByLabelText('Description')).toHaveClass(
      'rounded-control',
      'border-theme-border',
      'bg-surface',
      'text-content',
    );
  });
});
