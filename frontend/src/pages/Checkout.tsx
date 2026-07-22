import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '@/auth/AuthContext';
import { useBrand } from '@/brands/brandContext';
import { getCartQuote } from '@/cartQuote';
import { Button } from '@/components/Button';
import { CartSummary } from '@/components/CartSummary';
import {
  MutationFeedbackMessage,
  type MutationFeedback,
} from '@/components/MutationFeedback';
import Header from '@/pages/header';
import { appRoutes } from '@/routes';
import { useCartItems } from '@/serverState/cart';
import { useCreateOrder } from '@/serverState/orders';
import type { OrderListRequest } from '@/serverState/queryKeys';
import { createIdempotencyKey } from '@/services/idempotency';
import { useCheckoutQuote, useDeliveryAddresses } from '@/serverState/delivery';
import type { CheckoutSelection } from '@/services/delivery';
import { formatMoney } from '@/money';
import { getApiErrorMessage } from '@/services/errors';

export default function Checkout() {
  const { user } = useAuth();
  const brand = useBrand();
  const userId = user?._id ?? 'anonymous';
  const cart = useCartItems(userId);
  const addresses = useDeliveryAddresses(userId);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [deliveryOptionId, setDeliveryOptionId] =
    useState<CheckoutSelection['deliveryOptionId']>('standard');
  const [feedback, setFeedback] = useState<MutationFeedback>(null);
  const checkoutIdempotencyKey = useRef<string | null>(null);
  const orderRequest: OrderListRequest = {
    userId,
    scope: 'buyer',
    limit: null,
    offset: null,
    status: '',
    q: '',
  };
  const createOrder = useCreateOrder(userId, orderRequest);
  const quote = getCartQuote(cart.items, brand.currency);
  const savedAddresses = Array.isArray(addresses.data) ? addresses.data : [];
  const addressId = savedAddresses.some(
    (address) => address._id === selectedAddressId,
  )
    ? selectedAddressId
    : (savedAddresses.find((address) => address.isDefault)?._id ??
      savedAddresses[0]?._id ??
      '');
  const selection: CheckoutSelection | null = addressId
    ? { addressId, deliveryOptionId }
    : null;
  const checkoutQuote = useCheckoutQuote(userId, selection);

  async function placeOrder() {
    if (!cart.items.length) return;
    try {
      setFeedback(null);
      checkoutIdempotencyKey.current ??= createIdempotencyKey();
      if (!selection || !checkoutQuote.data) return;
      await createOrder.mutateAsync({
        idempotencyKey: checkoutIdempotencyKey.current,
        input: { ...selection, quoteId: checkoutQuote.data.quoteId },
      });
      checkoutIdempotencyKey.current = null;
      setFeedback({ type: 'success', message: 'Order placed successfully.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Unable to place order.', {
          CHECKOUT_QUOTE_CHANGED:
            'The cart price, availability, address, or delivery quote changed. Review the refreshed quote and try again.',
          INSUFFICIENT_INVENTORY:
            'A cart item is no longer available. Update the cart and try again.',
          PRODUCT_PRICE_REQUIRED:
            'A cart item no longer has a valid price. Update the cart and try again.',
        }),
      });
      await checkoutQuote.refetch();
    }
  }

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[900px] px-4 py-8">
        <h1 className="text-3xl font-bold">Checkout review</h1>
        <p>
          Review the current products, delivery address, demo delivery estimate,
          and authoritative total before placing your order.
        </p>
        <MutationFeedbackMessage className="mt-4" feedback={feedback} />
        {cart.isPending ? (
          <p role="status">Loading checkout review...</p>
        ) : cart.isLoadError ? (
          <p role="alert">Unable to load checkout review.</p>
        ) : (
          <CartSummary items={cart.items} />
        )}
        <section className="mt-6">
          <h2 className="text-xl font-bold">Delivery address</h2>
          {addresses.isPending ? (
            <p role="status">Loading delivery addresses...</p>
          ) : addresses.isError ? (
            <p role="alert">Unable to load delivery addresses.</p>
          ) : savedAddresses.length ? (
            <fieldset className="mt-3 grid gap-2">
              <legend className="sr-only">Choose a delivery address</legend>
              {savedAddresses.map((address) => (
                <label className="rounded-surface border p-3" key={address._id}>
                  <input
                    checked={addressId === address._id}
                    name="deliveryAddress"
                    type="radio"
                    value={address._id}
                    onChange={() => {
                      setSelectedAddressId(address._id);
                      checkoutIdempotencyKey.current = null;
                    }}
                  />{' '}
                  <strong>{address.label}</strong>
                  {address.isDefault ? ' (default)' : ''}: {address.line1},{' '}
                  {address.city}, {address.postalCode}, {address.countryCode}
                </label>
              ))}
            </fieldset>
          ) : (
            <p>
              No delivery address is saved.{' '}
              <Link to={appRoutes.addresses}>Add a delivery address</Link>{' '}
              before checkout.
            </p>
          )}
          {savedAddresses.length ? (
            <Link className="mt-2 inline-block" to={appRoutes.addresses}>
              Manage delivery addresses
            </Link>
          ) : null}
        </section>
        <section className="mt-6">
          <h2 className="text-xl font-bold">Delivery option</h2>
          <fieldset className="mt-3 grid gap-2">
            <legend className="sr-only">Choose a delivery option</legend>
            {[
              {
                id: 'standard' as const,
                label: 'Standard demo delivery',
                estimate: '3–5 business days (demo estimate)',
              },
              {
                id: 'express' as const,
                label: 'Express demo delivery',
                estimate: '1–2 business days (demo estimate)',
              },
            ].map((option) => (
              <label className="rounded-surface border p-3" key={option.id}>
                <input
                  checked={deliveryOptionId === option.id}
                  name="deliveryOption"
                  type="radio"
                  value={option.id}
                  onChange={() => {
                    setDeliveryOptionId(option.id);
                    checkoutIdempotencyKey.current = null;
                  }}
                />{' '}
                <strong>{option.label}</strong> — {option.estimate}
              </label>
            ))}
          </fieldset>
          <p className="mt-2 text-sm">
            These are deterministic demo estimates, not live carrier promises.
          </p>
        </section>
        <section className="mt-6" aria-live="polite">
          <h2 className="text-xl font-bold">Authoritative order total</h2>
          {!selection ? (
            <p>
              Select or add a delivery address to calculate the final total.
            </p>
          ) : checkoutQuote.isPending ? (
            <p role="status">Calculating checkout total...</p>
          ) : checkoutQuote.isError ? (
            <div role="alert">
              <p>Unable to calculate the checkout total.</p>
              <Button type="button" onClick={() => checkoutQuote.refetch()}>
                Retry total
              </Button>
            </div>
          ) : checkoutQuote.data ? (
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>
                  {formatMoney(
                    checkoutQuote.data.subtotal,
                    brand.locale,
                    brand.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>
                  {formatMoney(
                    checkoutQuote.data.discount,
                    brand.locale,
                    brand.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt>Shipping</dt>
                <dd>
                  {formatMoney(
                    checkoutQuote.data.shipping,
                    brand.locale,
                    brand.currency,
                  )}
                </dd>
              </div>
              <div className="font-bold">
                <dt>Total</dt>
                <dd>
                  {formatMoney(
                    checkoutQuote.data.total,
                    brand.locale,
                    brand.currency,
                  )}
                </dd>
              </div>
            </dl>
          ) : null}
        </section>
        <div className="mt-6 flex gap-4">
          <Button
            variant="primary"
            type="button"
            disabled={
              cart.isPending ||
              cart.isLoadError ||
              createOrder.isPending ||
              checkoutQuote.isPending ||
              !checkoutQuote.data ||
              !selection ||
              !cart.items.length ||
              quote.hasUnavailableItems
            }
            onClick={placeOrder}
          >
            {createOrder.isPending ? 'Placing order...' : 'Place order'}
          </Button>
          <Link to={appRoutes.cart}>Edit cart</Link>
          <Link to={appRoutes.buyerOrders}>View order history</Link>
        </div>
      </main>
    </div>
  );
}
