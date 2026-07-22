import { multiplyMoney, sumMoney } from '@/money';
import type { CartItem } from '@/serverState/cart';

export function getCartQuote(items: CartItem[], currency: string) {
  const lines = items.map((item) =>
    multiplyMoney(item.product.price, item.quantity, currency),
  );
  const total = sumMoney(lines, currency);
  const hasUnavailableItems =
    items.some(
      (item, index) =>
        item.product.status !== 'active' ||
        (item.product.inventory ?? 0) < item.quantity ||
        !item.product.price ||
        item.product.price.currency !== currency ||
        !lines[index],
    ) ||
    (items.length > 0 && !total);

  return { lines, total, hasUnavailableItems };
}
