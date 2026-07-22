import AppError from '@/errors/AppError';
import { moneyFromMinor } from '@/money';

export type DeliveryOptionId = 'standard' | 'express';

export type DeliveryOptionQuote = {
  id: DeliveryOptionId;
  label: string;
  estimate: string;
  shipping: { currency: string; amountMinor: string };
  shippingMinor: bigint;
};

export interface DeliveryQuoteProvider {
  getOption(id: string, currency: string): DeliveryOptionQuote;
  listOptions(currency: string): DeliveryOptionQuote[];
}

const options = {
  standard: {
    id: 'standard',
    label: 'Standard demo delivery',
    estimate: '3–5 business days (demo estimate)',
    shippingMinor: 499n,
  },
  express: {
    id: 'express',
    label: 'Express demo delivery',
    estimate: '1–2 business days (demo estimate)',
    shippingMinor: 999n,
  },
} as const;

export function getDeliveryOption(id: string, currency: string) {
  const option = options[id as DeliveryOptionId];
  if (!option)
    throw new AppError(
      400,
      'INVALID_DELIVERY_OPTION',
      'Delivery option is invalid',
    );
  return {
    id: option.id,
    label: option.label,
    estimate: option.estimate,
    shipping: moneyFromMinor(currency, option.shippingMinor),
    shippingMinor: option.shippingMinor,
  };
}

export function listDeliveryOptions(currency: string) {
  return Object.keys(options).map((id) => getDeliveryOption(id, currency));
}

export const deterministicDeliveryQuoteProvider: DeliveryQuoteProvider = {
  getOption: getDeliveryOption,
  listOptions: listDeliveryOptions,
};
