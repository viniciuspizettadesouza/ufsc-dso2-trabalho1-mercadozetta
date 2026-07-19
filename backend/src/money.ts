import { maximumMoneyMinor } from '@/database/schema';

export type Money = {
  currency: string;
  amountMinor: string;
};

export const maximumMoneyMinorString = maximumMoneyMinor.toString();
export const canonicalMoneyMinorPattern = /^(0|[1-9][0-9]*)$/;

export function isCanonicalMoneyMinor(value: string) {
  return (
    canonicalMoneyMinorPattern.test(value) && BigInt(value) <= maximumMoneyMinor
  );
}

export function sameMoney(left: Money | null, right: Money | null) {
  return (
    left?.currency === right?.currency &&
    left?.amountMinor === right?.amountMinor
  );
}

export function moneyFromMinor(currency: string, amountMinor: bigint): Money {
  return { currency, amountMinor: amountMinor.toString() };
}

export function checkedMoneyMultiply(amountMinor: bigint, quantity: number) {
  const result = amountMinor * BigInt(quantity);
  return result <= maximumMoneyMinor ? result : null;
}

export function checkedMoneyAdd(left: bigint, right: bigint) {
  const result = left + right;
  return result <= maximumMoneyMinor ? result : null;
}
