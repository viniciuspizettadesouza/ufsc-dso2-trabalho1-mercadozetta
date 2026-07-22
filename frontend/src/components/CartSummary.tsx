import { Link } from 'react-router';

import { useBrand } from '@/brands/brandContext';
import { getCartQuote } from '@/cartQuote';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { formatMoney } from '@/money';
import { appRoutes } from '@/routes';
import type { CartItem } from '@/serverState/cart';

type CartSummaryProps = {
  items: CartItem[];
  pendingItem?: string;
  onQuantityChange?: (productId: string, quantity: number) => void;
  onRemove?: (productId: string) => void;
};

export function CartSummary({
  items,
  pendingItem = '',
  onQuantityChange,
  onRemove,
}: CartSummaryProps) {
  const brand = useBrand();
  const quote = getCartQuote(items, brand.currency);
  const editable = Boolean(onQuantityChange && onRemove);

  if (!items.length) return <p>Cart is empty.</p>;

  return (
    <>
      <ul className="mt-4 space-y-4">
        {items.map((item, index) => (
          <li
            className="rounded-surface border border-theme-border bg-surface p-4 shadow-surface"
            key={item.product._id}
          >
            <Link
              className="font-bold"
              to={appRoutes.productDetail(item.product._id)}
            >
              {item.product.name}
            </Link>{' '}
            ×{' '}
            {editable ? (
              <label>
                <span className="sr-only">
                  Quantity for {item.product.name}
                </span>
                <Select
                  aria-label={`Quantity for ${item.product.name}`}
                  disabled={Boolean(pendingItem)}
                  value={item.quantity}
                  onChange={(event) =>
                    onQuantityChange?.(
                      item.product._id,
                      Number(event.target.value),
                    )
                  }
                >
                  {Array.from(
                    { length: Math.max(item.product.inventory ?? 1, 1) },
                    (_, optionIndex) => optionIndex + 1,
                  ).map((quantity) => (
                    <option key={quantity} value={quantity}>
                      {quantity}
                    </option>
                  ))}
                </Select>
              </label>
            ) : (
              item.quantity
            )}{' '}
            <span>
              {formatMoney(item.product.price, brand.locale, brand.currency) ??
                brand.copy.catalog.priceUnavailableLabel}
              {' each; '}
              {formatMoney(quote.lines[index], brand.locale, brand.currency) ??
                brand.copy.catalog.priceUnavailableLabel}
              {' quoted subtotal'}
            </span>{' '}
            {editable && (
              <Button
                type="button"
                disabled={Boolean(pendingItem)}
                onClick={() => onRemove?.(item.product._id)}
              >
                {pendingItem === item.product._id
                  ? 'Updating item...'
                  : `Remove ${item.product.name}`}
              </Button>
            )}
            {(item.product.status !== 'active' ||
              (item.product.inventory ?? 0) < item.quantity ||
              !quote.lines[index]) && (
              <span className="font-bold text-red-700"> Unavailable</span>
            )}
          </li>
        ))}
      </ul>
      {quote.total && (
        <p className="mt-4">
          Current cart quote:{' '}
          <strong>
            {formatMoney(quote.total, brand.locale, brand.currency)}
          </strong>
        </p>
      )}
      {quote.hasUnavailableItems && (
        <p role="alert">
          Update or remove unavailable items before placing your order.
        </p>
      )}
    </>
  );
}
