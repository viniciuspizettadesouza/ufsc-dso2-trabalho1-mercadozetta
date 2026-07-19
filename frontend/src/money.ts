export type Money = {
  currency: string;
  amountMinor: string;
};

const canonicalMinorPattern = /^(0|[1-9][0-9]*)$/;
const maximumMoneyMinor = 9_000_000_000_000_000n;

export function moneyMinorValue(money: Money | null, expectedCurrency: string) {
  if (
    !money ||
    money.currency !== expectedCurrency ||
    !canonicalMinorPattern.test(money.amountMinor)
  )
    return null;
  const amount = BigInt(money.amountMinor);
  return amount <= maximumMoneyMinor ? amount : null;
}

export function multiplyMoney(
  money: Money | null,
  quantity: number,
  expectedCurrency: string,
) {
  const amount = moneyMinorValue(money, expectedCurrency);
  if (amount === null) return null;
  const result = amount * BigInt(quantity);
  return result <= maximumMoneyMinor
    ? { currency: expectedCurrency, amountMinor: result.toString() }
    : null;
}

export function sumMoney(
  values: Array<Money | null>,
  expectedCurrency: string,
) {
  let total = 0n;
  for (const value of values) {
    const amount = moneyMinorValue(value, expectedCurrency);
    if (amount === null || total + amount > maximumMoneyMinor) return null;
    total += amount;
  }
  return { currency: expectedCurrency, amountMinor: total.toString() };
}

export function majorInputToMinor(value: string, exponent = 2) {
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(value.trim());
  if (!match || (match[2]?.length ?? 0) > exponent) return null;
  const fraction = (match[2] ?? '').padEnd(exponent, '0');
  const amount =
    BigInt(match[1]) * 10n ** BigInt(exponent) + BigInt(fraction || '0');
  return amount <= maximumMoneyMinor ? amount.toString() : null;
}

export function moneyToMajorInput(money: Money | null, exponent = 2) {
  if (!money || !canonicalMinorPattern.test(money.amountMinor)) return '';
  const scale = 10n ** BigInt(exponent);
  const amount = BigInt(money.amountMinor);
  const fraction = (amount % scale).toString().padStart(exponent, '0');
  return exponent
    ? `${amount / scale}.${fraction}`
    : (amount / scale).toString();
}

export function formatMoney(
  money: Money | null,
  locale: string,
  expectedCurrency: string,
  exponent = 2,
) {
  const validAmount = moneyMinorValue(money, expectedCurrency);
  if (validAmount === null) return null;

  const scale = 10n ** BigInt(exponent);
  const amount = validAmount;
  const integer = new Intl.NumberFormat(locale, {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(amount / scale);
  const fraction = (amount % scale).toString().padStart(exponent, '0');
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: expectedCurrency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).formatToParts(0);

  return parts
    .map((part) => {
      if (part.type === 'integer') return integer;
      if (part.type === 'fraction') return fraction;
      return part.value;
    })
    .join('');
}
