import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from '@/services/errors';

function apiError(data: { code?: string; error?: string }) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, null, {
    data,
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: {} } as never,
  });
}

describe('getApiErrorMessage', () => {
  it('prefers an explicit safe code mapping and then the API message', () => {
    expect(
      getApiErrorMessage(
        apiError({ code: 'DELIVERY_UNAVAILABLE' }),
        'Fallback',
        {
          DELIVERY_UNAVAILABLE: 'Delivery is unavailable.',
        },
      ),
    ).toBe('Delivery is unavailable.');
    expect(
      getApiErrorMessage(
        apiError({ error: 'Documented API error' }),
        'Fallback',
      ),
    ).toBe('Documented API error');
  });

  it('uses the domain fallback for unknown and non-Axios failures', () => {
    expect(getApiErrorMessage(apiError({ code: 'UNKNOWN' }), 'Fallback')).toBe(
      'Fallback',
    );
    expect(getApiErrorMessage(new Error('private failure'), 'Fallback')).toBe(
      'Fallback',
    );
  });
});
