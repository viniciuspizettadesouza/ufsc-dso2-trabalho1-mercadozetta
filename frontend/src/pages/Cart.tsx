import { useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '@/auth/AuthContext';
import { useBrand } from '@/brands/brandContext';
import { getCartQuote } from '@/cartQuote';
import { CartSummary } from '@/components/CartSummary';
import {
  MutationFeedbackMessage,
  type MutationFeedback,
} from '@/components/MutationFeedback';
import Header from '@/pages/header';
import { appRoutes } from '@/routes';
import { useDetailedCart } from '@/serverState/cart';

export default function Cart() {
  const { user } = useAuth();
  const brand = useBrand();
  const cart = useDetailedCart(user?._id ?? 'anonymous');
  const [pendingItem, setPendingItem] = useState('');
  const [feedback, setFeedback] = useState<MutationFeedback>(null);
  const quote = getCartQuote(cart.items, brand.currency);

  async function updateQuantity(productId: string, quantity: number) {
    try {
      setPendingItem(productId);
      setFeedback(null);
      await cart.updateQuantity({ productId, quantity });
      setFeedback({ type: 'success', message: 'Cart quantity updated.' });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Unable to update cart quantity.',
      });
    } finally {
      setPendingItem('');
    }
  }

  async function removeItem(productId: string) {
    try {
      setPendingItem(productId);
      setFeedback(null);
      await cart.removeItem(productId);
      setFeedback({ type: 'success', message: 'Item removed from cart.' });
    } catch {
      setFeedback({ type: 'error', message: 'Unable to remove cart item.' });
    } finally {
      setPendingItem('');
    }
  }

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[900px] px-4 py-8">
        <h1 className="text-3xl font-bold">Cart</h1>
        <MutationFeedbackMessage className="mt-4" feedback={feedback} />
        {cart.isPending ? (
          <p role="status">Loading cart...</p>
        ) : cart.isLoadError ? (
          <p role="alert">Unable to load cart.</p>
        ) : (
          <CartSummary
            items={cart.items}
            pendingItem={pendingItem}
            onQuantityChange={updateQuantity}
            onRemove={removeItem}
          />
        )}
        <div className="mt-6 flex gap-4">
          {cart.items.length > 0 && !quote.hasUnavailableItems && (
            <Link className="font-bold" to={appRoutes.checkout}>
              Review checkout
            </Link>
          )}
          <Link to={appRoutes.home}>Continue shopping</Link>
        </div>
      </main>
    </div>
  );
}
