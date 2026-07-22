import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '@/logging';
import { createDevelopmentAccountMessageSender } from '@/services/developmentAccountMessageSender';

vi.mock('@/logging', () => ({ logger: { info: vi.fn() } }));

describe('developmentAccountMessageSender', () => {
  beforeEach(() => vi.mocked(logger.info).mockClear());

  it('writes a local confirmation URL without activating production delivery', async () => {
    const sender = createDevelopmentAccountMessageSender(
      'http://localhost:5173/',
    );

    await sender.enqueue({
      kind: 'password_reset',
      tenantId: 'mercadozetta',
      userId: 'user-1',
      email: 'buyer@example.com',
      token: 'selector.secret',
      expiresAt: new Date('2026-07-22T11:00:00.000Z'),
    });

    expect(logger.info).toHaveBeenCalledWith({
      event: 'development_account_message',
      kind: 'password_reset',
      tenantId: 'mercadozetta',
      userId: 'user-1',
      deliveryUrl:
        'http://localhost:5173/password-reset/confirm#token=selector.secret',
    });
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain(
      'buyer@example.com',
    );
  });

  it.each([
    ['email_verification', '/email-verification/confirm'],
    ['email_change', '/account/email-change/confirm'],
  ] as const)('routes %s tokens through a URL fragment', async (kind, path) => {
    const sender = createDevelopmentAccountMessageSender(
      'http://localhost:5173',
    );

    await sender.enqueue({
      kind,
      tenantId: 'mercadozetta',
      userId: 'user-1',
      email: 'buyer@example.com',
      token: 'selector.secret',
      expiresAt: new Date('2026-07-22T11:00:00.000Z'),
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        kind,
        deliveryUrl: `http://localhost:5173${path}#token=selector.secret`,
      }),
    );
  });

  it('logs reset notices without a token-bearing delivery URL', async () => {
    const sender = createDevelopmentAccountMessageSender(
      'http://localhost:5173',
    );

    await sender.enqueue({
      kind: 'password_reset_notice',
      tenantId: 'mercadozetta',
      userId: 'user-1',
      email: 'buyer@example.com',
      occurredAt: new Date('2026-07-22T11:00:00.000Z'),
    });

    expect(logger.info).toHaveBeenCalledWith({
      event: 'development_account_message',
      kind: 'password_reset_notice',
      tenantId: 'mercadozetta',
      userId: 'user-1',
    });
  });
});
