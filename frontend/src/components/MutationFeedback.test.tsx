import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MutationFeedbackMessage } from '@/components/MutationFeedback';

describe('MutationFeedbackMessage', () => {
  it('announces errors and success with the appropriate live semantics', () => {
    const { rerender } = render(
      <MutationFeedbackMessage
        feedback={{ type: 'error', message: 'Mutation failed.' }}
        id="mutation-feedback"
        variant="surface"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Mutation failed.');
    expect(screen.getByRole('alert')).toHaveAttribute(
      'id',
      'mutation-feedback',
    );
    expect(screen.getByRole('alert')).toHaveClass('bg-red-50');

    rerender(
      <MutationFeedbackMessage
        feedback={{ type: 'success', message: 'Mutation completed.' }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Mutation completed.');
    expect(screen.getByRole('status')).toHaveClass('text-green-700');
  });

  it('renders nothing without feedback', () => {
    const { container } = render(<MutationFeedbackMessage feedback={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
