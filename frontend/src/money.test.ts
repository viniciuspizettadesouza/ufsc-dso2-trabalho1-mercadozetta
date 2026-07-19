import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  majorInputToMinor,
  moneyToMajorInput,
  multiplyMoney,
  sumMoney,
} from '@/money';

describe('exact money presentation', () => {
  it('converts canonical major-unit input without floating-point arithmetic', () => {
    expect(majorInputToMinor('0')).toBe('0');
    expect(majorInputToMinor('12.3')).toBe('1230');
    expect(majorInputToMinor('12.34')).toBe('1234');
    expect(majorInputToMinor('12.345')).toBeNull();
    expect(majorInputToMinor('01.00')).toBeNull();
    expect(majorInputToMinor('90000000000000.01')).toBeNull();
  });

  it('formats exact USD and EUR tenant snapshots', () => {
    expect(
      formatMoney({ currency: 'USD', amountMinor: '123456' }, 'en-US', 'USD'),
    ).toBe('$1,234.56');
    expect(
      formatMoney({ currency: 'EUR', amountMinor: '123456' }, 'pt-PT', 'EUR'),
    ).toMatch(/1[.\s\u00a0]234,56\s€/);

    const historicalMoney = { currency: 'USD', amountMinor: '123456' };
    expect(formatMoney(historicalMoney, 'pt-PT', 'USD')).toMatch(
      /1[.\s\u00a0]234,56\sUS\$/,
    );
    expect(moneyToMajorInput(historicalMoney)).toBe('1234.56');
    expect(formatMoney(historicalMoney, 'pt-PT', 'EUR')).toBeNull();
    expect(formatMoney(null, 'pt-PT', 'EUR')).toBeNull();
  });

  it('calculates exact bounded cart quotes', () => {
    const price = { currency: 'USD', amountMinor: '12999' };
    expect(multiplyMoney(price, 3, 'USD')).toEqual({
      currency: 'USD',
      amountMinor: '38997',
    });
    expect(
      sumMoney([price, { currency: 'USD', amountMinor: '1' }], 'USD'),
    ).toEqual({ currency: 'USD', amountMinor: '13000' });
    expect(multiplyMoney(price, 1, 'EUR')).toBeNull();
    expect(
      multiplyMoney(
        { currency: 'USD', amountMinor: '9000000000000000' },
        2,
        'USD',
      ),
    ).toBeNull();
  });
});
