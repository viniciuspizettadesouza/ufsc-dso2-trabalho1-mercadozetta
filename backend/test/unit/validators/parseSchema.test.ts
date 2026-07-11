import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  firstDefined,
  hasRequestValue,
  parseAppSchema,
  requestString,
} from '../../../src/validators/parseSchema';

describe('parseAppSchema', () => {
  it('normalizes request values with the legacy fallback semantics', () => {
    expect(requestString('value', 'fallback')).toBe('value');
    expect(requestString('', 'fallback')).toBe('fallback');
    expect(requestString(undefined)).toBe('');
    expect(firstDefined(null, 'fallback')).toBe('fallback');
    expect(firstDefined(0, 'fallback')).toBe(0);
    expect(hasRequestValue(0)).toBe(true);
    expect(hasRequestValue(undefined)).toBe(false);
    expect(hasRequestValue(null)).toBe(false);
    expect(hasRequestValue('')).toBe(false);
  });

  it('maps ordinary Zod failures to the shared request error', () => {
    expect(() => parseAppSchema(z.string(), 42)).toThrow(expect.objectContaining({
      statusCode: 400,
      code: 'INVALID_REQUEST',
    }));
  });

});
