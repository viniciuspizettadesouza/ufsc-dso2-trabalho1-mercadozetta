import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrderStatusHistory } from '@/components/OrderStatusHistory';

describe('OrderStatusHistory', () => {
  it('renders a consistently labelled actor and timestamp timeline', () => {
    const changedAt = '2026-07-19T15:00:00.000Z';
    render(
      <OrderStatusHistory
        orderId="order-1"
        entries={[{ status: 'placed', actor: 'buyer-1', changedAt }]}
      />,
    );

    const timeline = screen.getByRole('list', {
      name: 'Status history for order order-1',
    });
    expect(timeline).toHaveTextContent('placed by buyer-1 at');
    expect(timeline).toHaveTextContent(new Date(changedAt).toLocaleString());
  });

  it('keeps an empty labelled timeline when history is unavailable', () => {
    render(<OrderStatusHistory orderId="order-2" />);
    expect(
      screen.getByRole('list', { name: 'Status history for order order-2' }),
    ).toBeEmptyDOMElement();
  });
});
