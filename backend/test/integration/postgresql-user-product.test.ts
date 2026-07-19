import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import * as schema from '@/database/schema';
import { createApp } from '@/app';
import { createPostgresComposition } from '@/compositionRoot';
import {
  accountTokens,
  cartItems,
  carts,
  auditEvents,
  notifications,
  orderItems,
  orders,
  orderStatusHistory,
  products,
  productPriceHistory,
  pendingEmailChanges,
  reviews,
  mutationIdempotency,
  sessions,
  users,
  watchlistEntries,
} from '@/database/schema';
import { isUuid } from '@/ids';
import type { AuditEventType } from '@/repositories/auditEventRepository';
import { PostgresProductRepository } from '@/repositories/postgres/productRepository';
import { PostgresAccountTokenRepository } from '@/repositories/postgres/accountTokenRepository';
import { PostgresPendingEmailChangeRepository } from '@/repositories/postgres/pendingEmailChangeRepository';
import { DuplicatePendingEmailError } from '@/repositories/pendingEmailChangeRepository';
import { PostgresUserRepository } from '@/repositories/postgres/userRepository';
import {
  PostgresCartRepository,
  PostgresCheckoutTransactionCoordinator,
  PostgresNotificationRepository,
  PostgresOrderItemRepository,
  PostgresOrderRepository,
} from '@/repositories/postgres/checkoutRepositories';
import {
  PostgresReviewRepository,
  PostgresWatchlistRepository,
} from '@/repositories/postgres/commerceRepositories';
import { PostgresSessionRepository } from '@/repositories/postgres/sessionRepository';
import { PostgresSellerOperationsRepository } from '@/repositories/postgres/sellerOperationsRepository';
import {
  createAuthService,
  type AuthSessionService,
} from '@/services/authService';
import { createProductService } from '@/services/productService';
import { createAccountSecurityService } from '@/services/accountSecurityService';
import { createAccountManagementService } from '@/services/accountManagementService';
import { createEmailChangeService } from '@/services/emailChangeService';
import { createAccountDeactivationService } from '@/services/accountDeactivationService';
import type { AccountMessage } from '@/services/accountMessageSender';
import { createCheckoutService } from '@/services/checkoutService';
import {
  createCartCommerceService,
  createNotificationCommerceService,
  createOrderCommerceService,
  createReviewCommerceService,
  createWatchlistCommerceService,
} from '@/services/commerceService';
import { createUserService } from '@/services/userService';
import { createSessionService } from '@/services/sessionService';
import { createSellerOperationsService } from '@/services/sellerOperationsService';
import { createRoutes } from '@/routes';

const connectionString = process.env.POSTGRESQL_URL;
if (!connectionString)
  throw new Error(
    'POSTGRESQL_URL is required for PostgreSQL integration tests',
  );

const pool = new Pool({ connectionString, max: 2 });
const db = drizzle({ client: pool, schema });
const userRepository = new PostgresUserRepository(db);
const accountTokenRepository = new PostgresAccountTokenRepository(db);
const pendingEmailChangeRepository = new PostgresPendingEmailChangeRepository(
  db,
);
const productRepository = new PostgresProductRepository(db);
const transactionCoordinator = new PostgresCheckoutTransactionCoordinator(db);
const userService = createUserService(userRepository);
const productService = createProductService(
  productRepository,
  userService,
  transactionCoordinator,
);
const checkoutService = createCheckoutService(transactionCoordinator);
const cartService = createCartCommerceService(
  new PostgresCartRepository(db),
  productRepository,
);
const notificationService = createNotificationCommerceService(
  new PostgresNotificationRepository(db),
);
const orderService = createOrderCommerceService(
  new PostgresOrderRepository(db),
  new PostgresOrderItemRepository(db),
  new PostgresNotificationRepository(db),
  transactionCoordinator,
);
const watchlistService = createWatchlistCommerceService(
  new PostgresWatchlistRepository(db),
  productRepository,
);
const reviewService = createReviewCommerceService(
  new PostgresReviewRepository(db),
  transactionCoordinator,
);
const sellerOperationsService = createSellerOperationsService(
  new PostgresSellerOperationsRepository(db),
);
const postgresSessions = new PostgresSessionRepository(db);
const postgresSessionService = createSessionService(
  postgresSessions,
  transactionCoordinator,
);
const postgresApp = createApp(
  createRoutes({
    ...createPostgresComposition(db),
    readiness: async () => ({
      ready: true,
      checks: { postgresql: 'connected' },
    }),
  }),
);

const userPayload = {
  email: 'seller@example.com',
  password: 'secret123',
  username: 'Seller',
  telephone: '123',
};
const firstPage = { limit: 20, offset: 0, scope: 'all' as const, q: '' };
const accountTokenKeyRing = {
  activeVersion: 'current',
  keys: { current: 'integration-account-token-secret' },
};
const accountSecurityConfig = {
  emailVerificationTokenTtlMs: 8 * 60 * 60 * 1000,
  emailChangeTokenTtlMs: 30 * 60 * 1000,
  passwordResetTokenTtlMs: 30 * 60 * 1000,
  requestResponseFloorMs: 500,
  issueCooldownMs: 60 * 1000,
  issueWindowMs: 60 * 60 * 1000,
  issueMax: 3,
};

class CapturingAccountMessageSender {
  messages: AccountMessage[] = [];

  async enqueue(message: AccountMessage) {
    this.messages.push(message);
  }
}

async function flushAccountMessages() {
  await new Promise((resolve) => setImmediate(resolve));
}

function accountSecurityService(sender: CapturingAccountMessageSender) {
  return createAccountSecurityService(transactionCoordinator, sender, {
    config: () => accountSecurityConfig,
    keyRing: () => accountTokenKeyRing,
  });
}

function accountManagementService(
  dependencies: Parameters<typeof createAccountManagementService>[1] = {},
) {
  return createAccountManagementService(transactionCoordinator, {
    hashPassword: (password) => bcrypt.hash(password, 4),
    ...dependencies,
  });
}

function emailChangeService(sender: CapturingAccountMessageSender) {
  return createEmailChangeService(transactionCoordinator, sender, {
    config: () => accountSecurityConfig,
    keyRing: () => accountTokenKeyRing,
  });
}

function accountDeactivationService() {
  return createAccountDeactivationService(transactionCoordinator, {
    hashPassword: (password) => bcrypt.hash(password, 4),
  });
}

function accountSecurityHttpApp(sender: CapturingAccountMessageSender) {
  return createApp(
    createRoutes({
      ...createPostgresComposition(db, sender),
      readiness: async () => ({
        ready: true,
        checks: { postgresql: 'connected' },
      }),
    }),
  );
}

function authCookies(response: request.Response) {
  const values = response.headers['set-cookie'] || [];
  const cookies = Array.isArray(values) ? values : [values];
  const csrf = cookies
    .find((cookie) => cookie.startsWith('mz_csrf='))
    ?.split(';', 1)[0]
    .slice('mz_csrf='.length);
  return { cookie: cookies.map((cookie) => cookie.split(';', 1)[0]), csrf };
}

describe('PostgreSQL user and product repositories', () => {
  beforeAll(async () => {
    await pool.query('select 1');
  });

  beforeEach(async () => {
    await pool.query('truncate table audit_events');
    await db.delete(notifications);
    await db.delete(reviews);
    await db.delete(mutationIdempotency);
    await db.delete(watchlistEntries);
    await db.delete(sessions);
    await db.delete(pendingEmailChanges);
    await db.delete(accountTokens);
    await db.delete(orderStatusHistory);
    await pool.query('truncate table product_price_history, order_items');
    await db.delete(orders);
    await db.delete(cartItems);
    await db.delete(carts);
    await db.delete(products);
    await db.delete(users);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('preserves tenant-qualified email uniqueness and public user errors', async () => {
    const mercadozettaUser = await userService.createUser(
      userPayload,
      'mercadozetta',
    );
    const campusUser = await userService.createUser(
      userPayload,
      'campus-market',
    );

    expect(isUuid(mercadozettaUser._id)).toBe(true);
    expect(isUuid(campusUser._id)).toBe(true);
    expect(mercadozettaUser).not.toHaveProperty('password');
    await expect(
      userService.createUser(userPayload, 'mercadozetta'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'USER_EXISTS' });

    const concurrentPayload = {
      ...userPayload,
      email: 'concurrent@example.com',
    };
    const concurrentCreates = await Promise.allSettled([
      userService.createUser(concurrentPayload, 'mercadozetta'),
      userService.createUser(concurrentPayload, 'mercadozetta'),
    ]);
    expect(
      concurrentCreates.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      concurrentCreates.filter(({ status }) => status === 'rejected'),
    ).toMatchObject([{ reason: { statusCode: 400, code: 'USER_EXISTS' } }]);
    await expect(
      userService.getPublicSellerProfile(mercadozettaUser._id, 'campus-market'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'SELLER_NOT_FOUND',
    });

    const [stored] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, mercadozettaUser._id));
    expect(stored.passwordHash).not.toBe(userPayload.password);
    await expect(
      bcrypt.compare(userPayload.password, stored.passwordHash),
    ).resolves.toBe(true);
  });

  it('persists tenant-scoped single-use account tokens and user security state', async () => {
    const user = await userService.createUser(userPayload, 'mercadozetta');
    const createdAt = new Date('2026-07-18T10:00:00.000Z');
    const firstTokenId = randomUUID();
    const firstHash = 'a'.repeat(64);

    await expect(
      userRepository.findForAccountSecurity(
        'mercadozetta',
        'SELLER@EXAMPLE.COM',
      ),
    ).resolves.toMatchObject({
      _id: user._id,
      emailVerifiedAt: null,
      emailVersion: 0,
      tokenVersion: 0,
    });

    await expect(
      accountTokenRepository.create({
        _id: firstTokenId,
        tenantId: 'mercadozetta',
        userId: user._id,
        purpose: 'email_verification',
        tokenHash: firstHash,
        tokenHashSecretVersion: 'current',
        emailVersion: 0,
        expiresAt: new Date('2026-07-18T18:00:00.000Z'),
        createdAt,
      }),
    ).resolves.toMatchObject({
      _id: firstTokenId,
      emailVersion: 0,
      tokenHash: firstHash,
    });
    await expect(
      accountTokenRepository.findById('campus-market', firstTokenId),
    ).resolves.toBeNull();
    await expect(
      accountTokenRepository.countIssuedSince(
        'mercadozetta',
        user._id,
        'email_verification',
        new Date('2026-07-18T09:00:00.000Z'),
      ),
    ).resolves.toBe(1);
    await expect(
      accountTokenRepository.findLatestIssuedAt(
        'mercadozetta',
        user._id,
        'email_verification',
      ),
    ).resolves.toEqual(createdAt);

    await expect(
      accountTokenRepository.create({
        _id: randomUUID(),
        tenantId: 'mercadozetta',
        userId: user._id,
        purpose: 'email_verification',
        tokenHash: 'b'.repeat(64),
        tokenHashSecretVersion: 'current',
        emailVersion: 0,
        expiresAt: new Date('2026-07-18T18:01:00.000Z'),
        createdAt: new Date('2026-07-18T10:01:00.000Z'),
      }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });

    await expect(
      accountTokenRepository.consume({
        tenantId: 'mercadozetta',
        tokenId: firstTokenId,
        purpose: 'email_verification',
        tokenHash: 'c'.repeat(64),
        emailVersion: 0,
        now: new Date('2026-07-18T10:05:00.000Z'),
      }),
    ).resolves.toBeNull();

    const resetTokenId = randomUUID();
    await accountTokenRepository.create({
      _id: resetTokenId,
      tenantId: 'mercadozetta',
      userId: user._id,
      purpose: 'password_reset',
      tokenHash: 'd'.repeat(64),
      tokenHashSecretVersion: 'current',
      expiresAt: new Date('2026-07-18T10:35:00.000Z'),
      createdAt: new Date('2026-07-18T10:05:00.000Z'),
    });
    await expect(
      accountTokenRepository.invalidateActive(
        'mercadozetta',
        user._id,
        'password_reset',
        'replaced',
        new Date('2026-07-18T10:06:00.000Z'),
        resetTokenId,
      ),
    ).resolves.toBe(0);
    await expect(
      accountTokenRepository.invalidateActive(
        'mercadozetta',
        user._id,
        'password_reset',
        'replaced',
        new Date('2026-07-18T10:06:00.000Z'),
      ),
    ).resolves.toBe(1);
    await expect(
      accountTokenRepository.findById('mercadozetta', resetTokenId),
    ).resolves.toMatchObject({ invalidationReason: 'replaced' });
    await expect(
      accountTokenRepository.consume({
        tenantId: 'mercadozetta',
        tokenId: firstTokenId,
        purpose: 'email_verification',
        tokenHash: firstHash,
        emailVersion: 0,
        now: new Date('2026-07-18T10:05:00.000Z'),
      }),
    ).resolves.toMatchObject({ consumedAt: expect.any(Date) });
    await expect(
      accountTokenRepository.consume({
        tenantId: 'mercadozetta',
        tokenId: firstTokenId,
        purpose: 'email_verification',
        tokenHash: firstHash,
        emailVersion: 0,
        now: new Date('2026-07-18T10:06:00.000Z'),
      }),
    ).resolves.toBeNull();

    await expect(
      userRepository.markEmailVerified(
        'mercadozetta',
        user._id,
        1,
        new Date('2026-07-18T10:07:00.000Z'),
      ),
    ).resolves.toBe(false);
    await expect(
      userRepository.markEmailVerified(
        'mercadozetta',
        user._id,
        0,
        new Date('2026-07-18T10:07:00.000Z'),
      ),
    ).resolves.toBe(true);
    await expect(
      userRepository.replacePasswordAndIncrementTokenVersion(
        'mercadozetta',
        user._id,
        'replacement-password-hash',
        new Date('2026-07-18T10:08:00.000Z'),
      ),
    ).resolves.toBe(true);
    await expect(
      userRepository.findForAccountSecurity(
        'mercadozetta',
        'seller@example.com',
      ),
    ).resolves.toMatchObject({
      emailVerifiedAt: new Date('2026-07-18T10:07:00.000Z'),
      passwordHash: 'replacement-password-hash',
      tokenVersion: 1,
    });
    await expect(
      accountTokenRepository.deleteRetired(
        new Date('2026-07-19T00:00:00.000Z'),
      ),
    ).resolves.toBe(2);
  });

  it('persists pending email and conditional account-management state', async () => {
    const user = await userService.createUser(
      { ...userPayload, email: 'management@example.com' },
      'mercadozetta',
    );
    const other = await userService.createUser(
      { ...userPayload, email: 'other-management@example.com' },
      'mercadozetta',
    );
    const campusUser = await userService.createUser(
      { ...userPayload, email: 'management@example.com' },
      'campus-market',
    );
    const createdAt = new Date('2026-07-19T12:00:00.000Z');
    const expiresAt = new Date('2026-07-19T12:30:00.000Z');

    await transactionCoordinator.run(async (repositories) => {
      await expect(
        repositories.users.findAccountSecurityByIdForUpdate(
          'mercadozetta',
          user._id,
        ),
      ).resolves.toMatchObject({ _id: user._id, deactivatedAt: null });
      await expect(
        repositories.pendingEmailChanges.save({
          _id: randomUUID(),
          tenantId: 'mercadozetta',
          userId: user._id,
          email: 'replacement@example.com',
          emailVersion: 0,
          expiresAt,
          createdAt,
        }),
      ).resolves.toMatchObject({
        userId: user._id,
        email: 'replacement@example.com',
      });
    });

    const replacementId = randomUUID();
    await expect(
      pendingEmailChangeRepository.save({
        _id: replacementId,
        tenantId: 'mercadozetta',
        userId: user._id,
        email: 'new-address@example.com',
        emailVersion: 0,
        expiresAt,
        createdAt: new Date('2026-07-19T12:01:00.000Z'),
      }),
    ).resolves.toMatchObject({
      _id: replacementId,
      email: 'new-address@example.com',
    });
    await expect(
      pendingEmailChangeRepository.findByUserForUpdate(
        'mercadozetta',
        user._id,
      ),
    ).resolves.toMatchObject({ _id: replacementId, emailVersion: 0 });

    await expect(
      pendingEmailChangeRepository.save({
        _id: randomUUID(),
        tenantId: 'mercadozetta',
        userId: other._id,
        email: 'NEW-ADDRESS@EXAMPLE.COM',
        emailVersion: 0,
        expiresAt,
        createdAt,
      }),
    ).rejects.toBeInstanceOf(DuplicatePendingEmailError);
    await expect(
      pendingEmailChangeRepository.save({
        _id: randomUUID(),
        tenantId: 'campus-market',
        userId: campusUser._id,
        email: 'new-address@example.com',
        emailVersion: 0,
        expiresAt,
        createdAt,
      }),
    ).resolves.toMatchObject({ tenantId: 'campus-market' });
    await expect(
      pendingEmailChangeRepository.save({
        _id: randomUUID(),
        tenantId: 'mercadozetta',
        userId: user._id,
        email: 'invalid-expiry@example.com',
        emailVersion: 0,
        expiresAt: createdAt,
        createdAt,
      }),
    ).rejects.toMatchObject({ cause: { code: '23514' } });

    const before = await userRepository.findAccountSecurityById(
      'mercadozetta',
      user._id,
    );
    await expect(
      userRepository.updateProfile(
        'mercadozetta',
        user._id,
        { username: 'managed user', telephone: null },
        new Date('2026-07-19T12:02:00.000Z'),
      ),
    ).resolves.toMatchObject({ username: 'managed user', telephone: null });
    await expect(
      userRepository.replaceAccountPassword({
        tenantId: 'mercadozetta',
        userId: user._id,
        expectedPasswordHash: before!.passwordHash,
        expectedTokenVersion: 0,
        passwordHash: 'managed-password-hash',
        now: new Date('2026-07-19T12:03:00.000Z'),
      }),
    ).resolves.toBe(true);
    await expect(
      userRepository.replaceAccountPassword({
        tenantId: 'mercadozetta',
        userId: user._id,
        expectedPasswordHash: before!.passwordHash,
        expectedTokenVersion: 0,
        passwordHash: 'stale-password-hash',
        now: new Date('2026-07-19T12:03:01.000Z'),
      }),
    ).resolves.toBe(false);
    await expect(
      userRepository.promoteAccountEmail({
        tenantId: 'mercadozetta',
        userId: user._id,
        expectedEmailVersion: 0,
        email: 'new-address@example.com',
        now: new Date('2026-07-19T12:04:00.000Z'),
      }),
    ).resolves.toBe(true);
    await expect(
      userRepository.deactivateAccount({
        tenantId: 'mercadozetta',
        userId: user._id,
        expectedPasswordHash: 'managed-password-hash',
        expectedTokenVersion: 2,
        passwordHash: 'unusable-password-hash',
        now: new Date('2026-07-19T12:05:00.000Z'),
      }),
    ).resolves.toBe(true);
    await expect(
      userRepository.findForAccountSecurity(
        'mercadozetta',
        'new-address@example.com',
      ),
    ).resolves.toMatchObject({
      emailVersion: 1,
      emailVerifiedAt: new Date('2026-07-19T12:04:00.000Z'),
      passwordHash: 'unusable-password-hash',
      tokenVersion: 3,
      deactivatedAt: new Date('2026-07-19T12:05:00.000Z'),
    });

    const emailChangeTokenId = randomUUID();
    await accountTokenRepository.create({
      _id: emailChangeTokenId,
      tenantId: 'mercadozetta',
      userId: user._id,
      purpose: 'email_change',
      tokenHash: 'e'.repeat(64),
      tokenHashSecretVersion: 'current',
      emailVersion: 1,
      expiresAt: new Date('2026-07-19T12:35:00.000Z'),
      createdAt: new Date('2026-07-19T12:05:00.000Z'),
    });
    await expect(
      accountTokenRepository.invalidateActive(
        'mercadozetta',
        user._id,
        'email_change',
        'account_deactivated',
        new Date('2026-07-19T12:06:00.000Z'),
      ),
    ).resolves.toBe(1);

    await db.insert(auditEvents).values(
      [
        'user.profile_updated',
        'user.password_changed',
        'user.email_change_requested',
        'user.email_changed',
        'user.deactivated',
      ].map((eventType) => ({
        id: randomUUID(),
        tenantId: 'mercadozetta',
        eventType,
        actorId: eventType === 'user.email_changed' ? null : user._id,
        resourceType: 'user',
        resourceId: user._id,
        occurredAt: new Date('2026-07-19T12:07:00.000Z'),
      })),
    );
    expect(
      (await db.select().from(auditEvents)).map(({ eventType }) => eventType),
    ).toEqual(
      expect.arrayContaining([
        'user.profile_updated',
        'user.password_changed',
        'user.email_change_requested',
        'user.email_changed',
        'user.deactivated',
      ]),
    );
    await expect(
      pendingEmailChangeRepository.deleteExpired(
        new Date('2026-07-19T13:00:00.000Z'),
      ),
    ).resolves.toBe(2);
  });

  it('updates profiles and gives one concurrent password change all credential effects', async () => {
    const created = await userService.createUser(
      { ...userPayload, email: 'managed-domain@example.com' },
      'mercadozetta',
    );
    const session = await postgresSessionService.createSession(
      created._id,
      'mercadozetta',
      0,
      'account management browser',
      new Date('2026-07-19T13:00:00.000Z'),
    );
    const resetTokenId = randomUUID();
    await accountTokenRepository.create({
      _id: resetTokenId,
      tenantId: 'mercadozetta',
      userId: created._id,
      purpose: 'password_reset',
      tokenHash: 'f'.repeat(64),
      tokenHashSecretVersion: 'current',
      expiresAt: new Date('2026-07-19T14:00:00.000Z'),
      createdAt: new Date('2026-07-19T13:00:00.000Z'),
    });
    const profileService = accountManagementService();
    await expect(
      profileService.updateProfile(
        { username: ' Managed Domain ', telephone: null },
        created._id,
        'mercadozetta',
        new Date('2026-07-19T13:01:00.000Z'),
      ),
    ).resolves.toMatchObject({ username: 'Managed Domain', telephone: null });

    let hashing = 0;
    let releaseHashes!: () => void;
    const hashGate = new Promise<void>((resolve) => {
      releaseHashes = resolve;
    });
    const service = accountManagementService({
      hashPassword: async (password) => {
        hashing += 1;
        if (hashing === 2) releaseHashes();
        await hashGate;
        return bcrypt.hash(password, 4);
      },
    });
    const changedAt = new Date('2026-07-19T13:02:00.000Z');
    const changes = await Promise.allSettled([
      service.changePassword(
        {
          currentPassword: userPayload.password,
          password: 'replacement-one',
          passwordConfirmation: 'replacement-one',
        },
        created._id,
        'mercadozetta',
        changedAt,
      ),
      service.changePassword(
        {
          currentPassword: userPayload.password,
          password: 'replacement-two',
          passwordConfirmation: 'replacement-two',
        },
        created._id,
        'mercadozetta',
        changedAt,
      ),
    ]);

    expect(changes.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(changes.filter(({ status }) => status === 'rejected')).toMatchObject(
      [{ reason: { code: 'ACCOUNT_STATE_CHANGED' } }],
    );
    const state = await userRepository.findAccountSecurityById(
      'mercadozetta',
      created._id,
    );
    expect(state).toMatchObject({ tokenVersion: 1 });
    expect(
      (await bcrypt.compare('replacement-one', state!.passwordHash)) ||
        (await bcrypt.compare('replacement-two', state!.passwordHash)),
    ).toBe(true);
    await expect(
      postgresSessions.isActive(
        'mercadozetta',
        created._id,
        session.session.id,
        0,
        new Date('2026-07-19T13:03:00.000Z'),
      ),
    ).resolves.toBe(false);
    await expect(
      accountTokenRepository.findById('mercadozetta', resetTokenId),
    ).resolves.toMatchObject({ invalidationReason: 'password_change' });
    const accountAudits = (await db.select().from(auditEvents)).filter(
      ({ resourceId }) => resourceId === created._id,
    );
    expect(
      accountAudits.filter(
        ({ eventType }) => eventType === 'user.profile_updated',
      ),
    ).toHaveLength(1);
    expect(
      accountAudits.filter(
        ({ eventType }) => eventType === 'user.password_changed',
      ),
    ).toHaveLength(1);
    expect(
      accountAudits.filter(
        ({ eventType, metadata }) =>
          eventType === 'session.revoked' &&
          metadata?.reason === 'password_change',
      ),
    ).toHaveLength(1);
  });

  it('rolls back profile and password mutations when account audit insertion fails', async () => {
    const created = await userService.createUser(
      { ...userPayload, email: 'managed-rollback@example.com' },
      'mercadozetta',
    );
    const before = await userRepository.findAccountSecurityById(
      'mercadozetta',
      created._id,
    );
    const session = await postgresSessionService.createSession(
      created._id,
      'mercadozetta',
      0,
      'account management rollback browser',
      new Date('2026-07-19T13:10:00.000Z'),
    );
    const resetTokenId = randomUUID();
    await accountTokenRepository.create({
      _id: resetTokenId,
      tenantId: 'mercadozetta',
      userId: created._id,
      purpose: 'password_reset',
      tokenHash: '9'.repeat(64),
      tokenHashSecretVersion: 'current',
      expiresAt: new Date('2026-07-19T14:10:00.000Z'),
      createdAt: new Date('2026-07-19T13:10:00.000Z'),
    });
    await pool.query(`
      create function reject_account_management_audit() returns trigger
      language plpgsql as $$
      begin
        if new.event_type in ('user.profile_updated', 'user.password_changed') then
          raise exception 'forced account management audit failure';
        end if;
        return new;
      end;
      $$;
      create trigger reject_account_management_audit_insert
      before insert on audit_events
      for each row execute function reject_account_management_audit();
    `);
    const service = accountManagementService();
    try {
      await expect(
        service.updateProfile(
          { username: 'must not commit' },
          created._id,
          'mercadozetta',
          new Date('2026-07-19T13:11:00.000Z'),
        ),
      ).rejects.toMatchObject({
        cause: {
          message: expect.stringContaining(
            'forced account management audit failure',
          ),
        },
      });
      await expect(
        service.changePassword(
          {
            currentPassword: userPayload.password,
            password: 'must-not-commit',
            passwordConfirmation: 'must-not-commit',
          },
          created._id,
          'mercadozetta',
          new Date('2026-07-19T13:12:00.000Z'),
        ),
      ).rejects.toMatchObject({
        cause: {
          message: expect.stringContaining(
            'forced account management audit failure',
          ),
        },
      });
    } finally {
      await pool.query(`
        drop trigger reject_account_management_audit_insert on audit_events;
        drop function reject_account_management_audit();
      `);
    }

    const after = await userRepository.findAccountSecurityById(
      'mercadozetta',
      created._id,
    );
    expect(after).toMatchObject({
      passwordHash: before!.passwordHash,
      tokenVersion: 0,
    });
    await expect(
      userRepository.findPublicById('mercadozetta', created._id),
    ).resolves.toMatchObject({ username: userPayload.username.toLowerCase() });
    await expect(
      postgresSessions.isActive(
        'mercadozetta',
        created._id,
        session.session.id,
        0,
        new Date('2026-07-19T13:13:00.000Z'),
      ),
    ).resolves.toBe(true);
    await expect(
      accountTokenRepository.findById('mercadozetta', resetTokenId),
    ).resolves.not.toHaveProperty('invalidatedAt');
  });

  it('replaces pending email changes and gives one tenant-bound confirmation all credential effects', async () => {
    const sender = new CapturingAccountMessageSender();
    const service = emailChangeService(sender);
    const created = await userService.createUser(
      { ...userPayload, email: 'email-change@example.com' },
      'mercadozetta',
    );
    const session = await postgresSessionService.createSession(
      created._id,
      'mercadozetta',
      0,
      'email change browser',
      new Date('2026-07-19T14:00:00.000Z'),
    );
    const peerTokenIds: string[] = [];
    for (const purpose of ['email_verification', 'password_reset'] as const) {
      const tokenId = randomUUID();
      peerTokenIds.push(tokenId);
      await accountTokenRepository.create({
        _id: tokenId,
        tenantId: 'mercadozetta',
        userId: created._id,
        purpose,
        tokenHash:
          purpose === 'email_verification' ? 'a'.repeat(64) : 'b'.repeat(64),
        tokenHashSecretVersion: 'current',
        ...(purpose === 'email_verification' ? { emailVersion: 0 } : {}),
        expiresAt: new Date('2026-07-19T15:00:00.000Z'),
        createdAt: new Date('2026-07-19T14:00:00.000Z'),
      });
    }

    await service.requestEmailChange(
      {
        email: 'first-replacement@example.com',
        currentPassword: userPayload.password,
      },
      created._id,
      'mercadozetta',
      new Date('2026-07-19T14:01:00.000Z'),
    );
    await flushAccountMessages();
    const firstMessage = sender.messages.at(-1);
    if (!firstMessage || !('token' in firstMessage))
      throw new Error('Expected first email-change token message');

    await service.requestEmailChange(
      {
        email: 'final-replacement@example.com',
        currentPassword: userPayload.password,
      },
      created._id,
      'mercadozetta',
      new Date('2026-07-19T14:02:00.000Z'),
    );
    await flushAccountMessages();
    const finalMessage = sender.messages.at(-1);
    if (!finalMessage || !('token' in finalMessage))
      throw new Error('Expected replacement email-change token message');

    await expect(
      service.confirmEmailChange(
        { token: firstMessage.token },
        'mercadozetta',
        new Date('2026-07-19T14:03:00.000Z'),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN' });
    await expect(
      service.confirmEmailChange(
        { token: finalMessage.token },
        'campus-market',
        new Date('2026-07-19T14:03:00.000Z'),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN' });

    const confirmations = await Promise.allSettled([
      service.confirmEmailChange(
        { token: finalMessage.token },
        'mercadozetta',
        new Date('2026-07-19T14:04:00.000Z'),
      ),
      service.confirmEmailChange(
        { token: finalMessage.token },
        'mercadozetta',
        new Date('2026-07-19T14:04:00.000Z'),
      ),
    ]);
    expect(
      confirmations.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      confirmations.filter(({ status }) => status === 'rejected'),
    ).toMatchObject([{ reason: { code: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN' } }]);

    await expect(
      userRepository.findAccountSecurityById('mercadozetta', created._id),
    ).resolves.toMatchObject({
      email: 'final-replacement@example.com',
      emailVersion: 1,
      tokenVersion: 1,
      emailVerifiedAt: new Date('2026-07-19T14:04:00.000Z'),
    });
    await expect(
      pendingEmailChangeRepository.findByUser('mercadozetta', created._id),
    ).resolves.toBeNull();
    await expect(
      postgresSessions.isActive(
        'mercadozetta',
        created._id,
        session.session.id,
        0,
        new Date('2026-07-19T14:05:00.000Z'),
      ),
    ).resolves.toBe(false);
    for (const tokenId of peerTokenIds) {
      await expect(
        accountTokenRepository.findById('mercadozetta', tokenId),
      ).resolves.toMatchObject({ invalidationReason: 'email_changed' });
    }
    const accountAudits = (await db.select().from(auditEvents)).filter(
      ({ resourceId }) => resourceId === created._id,
    );
    expect(
      accountAudits.filter(
        ({ eventType }) => eventType === 'user.email_change_requested',
      ),
    ).toHaveLength(2);
    expect(
      accountAudits.filter(
        ({ eventType }) => eventType === 'user.email_changed',
      ),
    ).toMatchObject([{ actorId: null }]);
  });

  it('keeps pending email state when confirmation loses a uniqueness race', async () => {
    const sender = new CapturingAccountMessageSender();
    const service = emailChangeService(sender);
    const created = await userService.createUser(
      { ...userPayload, email: 'email-race@example.com' },
      'mercadozetta',
    );
    await service.requestEmailChange(
      {
        email: 'claimed-before-confirm@example.com',
        currentPassword: userPayload.password,
      },
      created._id,
      'mercadozetta',
      new Date('2026-07-19T14:10:00.000Z'),
    );
    await flushAccountMessages();
    const message = sender.messages.at(-1);
    if (!message || !('token' in message))
      throw new Error('Expected email-change token message');
    await userService.createUser(
      { ...userPayload, email: 'CLAIMED-BEFORE-CONFIRM@example.com' },
      'mercadozetta',
    );

    await expect(
      service.confirmEmailChange(
        { token: message.token },
        'mercadozetta',
        new Date('2026-07-19T14:11:00.000Z'),
      ),
    ).rejects.toMatchObject({ code: 'EMAIL_UNAVAILABLE' });
    await expect(
      userRepository.findAccountSecurityById('mercadozetta', created._id),
    ).resolves.toMatchObject({
      email: 'email-race@example.com',
      emailVersion: 0,
      tokenVersion: 0,
    });
    await expect(
      pendingEmailChangeRepository.findByUser('mercadozetta', created._id),
    ).resolves.toMatchObject({ email: 'claimed-before-confirm@example.com' });
    await expect(
      accountTokenRepository.findById(
        'mercadozetta',
        message.token.split('.')[0],
      ),
    ).resolves.not.toHaveProperty('consumedAt');
  });

  it('rolls back email promotion, token consumption and session revocation when auditing fails', async () => {
    const sender = new CapturingAccountMessageSender();
    const service = emailChangeService(sender);
    const created = await userService.createUser(
      { ...userPayload, email: 'email-change-rollback@example.com' },
      'mercadozetta',
    );
    const session = await postgresSessionService.createSession(
      created._id,
      'mercadozetta',
      0,
      'email change rollback browser',
      new Date('2026-07-19T14:20:00.000Z'),
    );
    await service.requestEmailChange(
      {
        email: 'email-change-must-not-commit@example.com',
        currentPassword: userPayload.password,
      },
      created._id,
      'mercadozetta',
      new Date('2026-07-19T14:21:00.000Z'),
    );
    await flushAccountMessages();
    const message = sender.messages.at(-1);
    if (!message || !('token' in message))
      throw new Error('Expected rollback email-change token message');

    await pool.query(`
      create function reject_email_change_audit() returns trigger
      language plpgsql as $$
      begin
        if new.event_type = 'user.email_changed' then
          raise exception 'forced email change audit failure';
        end if;
        return new;
      end;
      $$;
      create trigger reject_email_change_audit_insert
      before insert on audit_events
      for each row execute function reject_email_change_audit();
    `);
    try {
      await expect(
        service.confirmEmailChange(
          { token: message.token },
          'mercadozetta',
          new Date('2026-07-19T14:22:00.000Z'),
        ),
      ).rejects.toMatchObject({
        cause: {
          message: expect.stringContaining('forced email change audit failure'),
        },
      });
    } finally {
      await pool.query(`
        drop trigger reject_email_change_audit_insert on audit_events;
        drop function reject_email_change_audit();
      `);
    }

    await expect(
      userRepository.findAccountSecurityById('mercadozetta', created._id),
    ).resolves.toMatchObject({
      email: 'email-change-rollback@example.com',
      emailVersion: 0,
      tokenVersion: 0,
    });
    await expect(
      pendingEmailChangeRepository.findByUser('mercadozetta', created._id),
    ).resolves.toMatchObject({
      email: 'email-change-must-not-commit@example.com',
    });
    await expect(
      accountTokenRepository.findById(
        'mercadozetta',
        message.token.split('.')[0],
      ),
    ).resolves.not.toHaveProperty('consumedAt');
    await expect(
      postgresSessions.isActive(
        'mercadozetta',
        created._id,
        session.session.id,
        0,
        new Date('2026-07-19T14:23:00.000Z'),
      ),
    ).resolves.toBe(true);
  });

  it('blocks deactivation for active buyer and seller order obligations', async () => {
    const seller = await userService.createUser(
      { ...userPayload, email: 'blocked-seller@example.com' },
      'mercadozetta',
    );
    const buyer = await userService.createUser(
      { ...userPayload, email: 'blocked-buyer@example.com' },
      'mercadozetta',
    );
    const product = await productRepository.create({
      tenantId: 'mercadozetta',
      seller: seller._id,
      name: 'Active obligation',
      description: '',
      category: 'general',
      subcategory: '',
      inventory: 2,
      image: 'active-obligation.png',
      status: 'active',
      price: { currency: 'USD', amountMinor: '1000' },
    });
    const orderId = randomUUID();
    const orderedAt = new Date('2026-07-19T15:00:00.000Z');
    await db.insert(orders).values({
      id: orderId,
      tenantId: 'mercadozetta',
      buyerId: buyer._id,
      checkoutIdempotencyKey: randomUUID(),
      status: 'shipped',
      createdAt: orderedAt,
      updatedAt: orderedAt,
    });
    await db.insert(orderItems).values({
      id: randomUUID(),
      tenantId: 'mercadozetta',
      orderId,
      productId: product._id,
      sellerId: seller._id,
      productName: product.name,
      quantity: 1,
      createdAt: orderedAt,
      updatedAt: orderedAt,
    });
    const service = accountDeactivationService();

    for (const account of [seller, buyer])
      await expect(
        service.deactivateAccount(
          {
            currentPassword: userPayload.password,
            confirmation: 'DEACTIVATE',
          },
          account._id,
          'mercadozetta',
          new Date('2026-07-19T15:01:00.000Z'),
        ),
      ).rejects.toMatchObject({
        code: 'ACCOUNT_DEACTIVATION_BLOCKED_ACTIVE_ORDERS',
      });

    const storedUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, [seller._id, buyer._id]));
    expect(
      storedUsers.every(({ deactivatedAt }) => deactivatedAt === null),
    ).toBe(true);
    expect(
      (await db.select().from(auditEvents)).filter(
        ({ eventType }) => eventType === 'user.deactivated',
      ),
    ).toHaveLength(0);
  });

  it('deactivates one concurrent attempt while preserving history and tenant isolation', async () => {
    const target = await userService.createUser(
      { ...userPayload, email: 'lifecycle-target@example.com' },
      'mercadozetta',
    );
    const other = await userService.createUser(
      { ...userPayload, email: 'lifecycle-other@example.com' },
      'mercadozetta',
    );
    const campus = await userService.createUser(
      { ...userPayload, email: 'lifecycle-campus@example.com' },
      'campus-market',
    );
    const targetProduct = await productRepository.create({
      tenantId: 'mercadozetta',
      seller: target._id,
      name: 'Retained target product',
      description: '',
      category: 'general',
      subcategory: '',
      inventory: 7,
      image: 'retained-target.png',
      status: 'active',
      price: { currency: 'USD', amountMinor: '1000' },
    });
    const alreadyArchived = await productRepository.create({
      tenantId: 'mercadozetta',
      seller: target._id,
      name: 'Already archived target product',
      description: '',
      category: 'general',
      subcategory: '',
      inventory: 4,
      image: 'already-archived.png',
      status: 'archived',
      price: { currency: 'USD', amountMinor: '1000' },
    });
    const campusProduct = await productRepository.create({
      tenantId: 'campus-market',
      seller: campus._id,
      name: 'Campus retained product',
      description: '',
      category: 'general',
      subcategory: '',
      inventory: 5,
      image: 'campus-retained.png',
      status: 'active',
      price: { currency: 'USD', amountMinor: '1000' },
    });
    const historyAt = new Date('2026-07-19T15:10:00.000Z');
    const orderId = randomUUID();
    await db.insert(orders).values({
      id: orderId,
      tenantId: 'mercadozetta',
      buyerId: other._id,
      checkoutIdempotencyKey: randomUUID(),
      status: 'delivered',
      createdAt: historyAt,
      updatedAt: historyAt,
    });
    await db.insert(orderItems).values({
      id: randomUUID(),
      tenantId: 'mercadozetta',
      orderId,
      productId: targetProduct._id,
      sellerId: target._id,
      productName: targetProduct.name,
      quantity: 1,
      createdAt: historyAt,
      updatedAt: historyAt,
    });
    await db.insert(orderStatusHistory).values({
      tenantId: 'mercadozetta',
      orderId,
      sequence: 1,
      status: 'delivered',
      actorId: target._id,
      changedAt: historyAt,
    });
    await db.insert(reviews).values({
      id: randomUUID(),
      tenantId: 'mercadozetta',
      productId: targetProduct._id,
      authorId: target._id,
      rating: 5,
      comment: 'Retained review',
      createdAt: historyAt,
      updatedAt: historyAt,
    });
    await cartService.setCartItem(
      target._id,
      'mercadozetta',
      targetProduct._id,
      1,
    );
    await watchlistService.addWatchlist(
      target._id,
      'mercadozetta',
      targetProduct._id,
    );
    await db.insert(notifications).values({
      id: randomUUID(),
      tenantId: 'mercadozetta',
      userId: target._id,
      message: 'Disposable target notice',
      createdAt: historyAt,
      updatedAt: historyAt,
    });
    await cartService.setCartItem(
      campus._id,
      'campus-market',
      campusProduct._id,
      1,
    );
    await watchlistService.addWatchlist(
      campus._id,
      'campus-market',
      campusProduct._id,
    );
    await db.insert(notifications).values({
      id: randomUUID(),
      tenantId: 'campus-market',
      userId: campus._id,
      message: 'Campus notice remains',
      createdAt: historyAt,
      updatedAt: historyAt,
    });
    const session = await postgresSessionService.createSession(
      target._id,
      'mercadozetta',
      0,
      'deactivation browser',
      historyAt,
    );
    const tokenIds: string[] = [];
    for (const purpose of [
      'email_verification',
      'password_reset',
      'email_change',
    ] as const) {
      const tokenId = randomUUID();
      tokenIds.push(tokenId);
      await accountTokenRepository.create({
        _id: tokenId,
        tenantId: 'mercadozetta',
        userId: target._id,
        purpose,
        tokenHash: `${purpose.length}`.repeat(64).slice(0, 64),
        tokenHashSecretVersion: 'current',
        ...(purpose === 'password_reset' ? {} : { emailVersion: 0 }),
        expiresAt: new Date('2026-07-19T16:10:00.000Z'),
        createdAt: historyAt,
      });
    }
    await pendingEmailChangeRepository.save({
      _id: randomUUID(),
      tenantId: 'mercadozetta',
      userId: target._id,
      email: 'pending-lifecycle@example.com',
      emailVersion: 0,
      expiresAt: new Date('2026-07-19T15:40:00.000Z'),
      createdAt: historyAt,
    });
    const service = accountDeactivationService();
    const deactivatedAt = new Date('2026-07-19T15:20:00.000Z');
    const attempts = await Promise.allSettled([
      service.deactivateAccount(
        {
          currentPassword: userPayload.password,
          confirmation: 'DEACTIVATE',
        },
        target._id,
        'mercadozetta',
        deactivatedAt,
      ),
      service.deactivateAccount(
        {
          currentPassword: userPayload.password,
          confirmation: 'DEACTIVATE',
        },
        target._id,
        'mercadozetta',
        deactivatedAt,
      ),
    ]);
    expect(
      attempts.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter(({ status }) => status === 'rejected'),
    ).toMatchObject([{ reason: { code: 'ACCOUNT_STATE_CHANGED' } }]);

    const [storedTarget] = await db
      .select()
      .from(users)
      .where(eq(users.id, target._id));
    expect(storedTarget).toMatchObject({
      deactivatedAt,
      tokenVersion: 1,
      username: null,
      telephone: null,
      email: 'lifecycle-target@example.com',
    });
    await expect(
      bcrypt.compare(userPayload.password, storedTarget.passwordHash),
    ).resolves.toBe(false);
    await expect(
      userRepository.findPublicById('mercadozetta', target._id),
    ).resolves.toBeNull();
    await expect(
      userRepository.findForAuthentication(
        'mercadozetta',
        'lifecycle-target@example.com',
      ),
    ).resolves.toBeNull();
    await expect(
      userRepository.findTokenVersion('mercadozetta', target._id),
    ).resolves.toBeNull();
    await expect(
      postgresSessions.isActive(
        'mercadozetta',
        target._id,
        session.session.id,
        0,
        new Date('2026-07-19T15:21:00.000Z'),
      ),
    ).resolves.toBe(false);
    for (const tokenId of tokenIds)
      await expect(
        accountTokenRepository.findById('mercadozetta', tokenId),
      ).resolves.toMatchObject({ invalidationReason: 'account_deactivated' });
    await expect(
      pendingEmailChangeRepository.findByUser('mercadozetta', target._id),
    ).resolves.toBeNull();
    await expect(
      productRepository.findById('mercadozetta', targetProduct._id),
    ).resolves.toMatchObject({ status: 'archived', inventory: 7 });
    await expect(
      productRepository.findById('mercadozetta', alreadyArchived._id),
    ).resolves.toMatchObject({ status: 'archived', inventory: 4 });
    expect(
      await db.select().from(carts).where(eq(carts.buyerId, target._id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(watchlistEntries)
        .where(eq(watchlistEntries.userId, target._id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, target._id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(carts).where(eq(carts.buyerId, campus._id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(watchlistEntries)
        .where(eq(watchlistEntries.userId, campus._id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, campus._id)),
    ).toHaveLength(1);
    expect(
      await db.select().from(orders).where(eq(orders.id, orderId)),
    ).toHaveLength(1);
    expect(
      await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, orderId)),
    ).toHaveLength(1);
    expect(
      await db.select().from(reviews).where(eq(reviews.authorId, target._id)),
    ).toHaveLength(1);
    const lifecycleAudits = (await db.select().from(auditEvents)).filter(
      ({ resourceId }) => resourceId === target._id,
    );
    expect(lifecycleAudits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'user.deactivated',
          actorId: target._id,
          metadata: { archivedListingCount: 1 },
        }),
        expect.objectContaining({
          eventType: 'session.revoked',
          metadata: { reason: 'account_deactivated' },
        }),
      ]),
    );
    await expect(
      userService.createUser(
        { ...userPayload, email: 'LIFECYCLE-TARGET@example.com' },
        'mercadozetta',
      ),
    ).rejects.toMatchObject({ code: 'USER_EXISTS' });
  });

  it('rolls back every deactivation effect when audit insertion fails', async () => {
    const target = await userService.createUser(
      { ...userPayload, email: 'deactivation-rollback@example.com' },
      'mercadozetta',
    );
    const product = await productRepository.create({
      tenantId: 'mercadozetta',
      seller: target._id,
      name: 'Rollback listing',
      description: '',
      category: 'general',
      subcategory: '',
      inventory: 3,
      image: 'rollback-listing.png',
      status: 'active',
      price: { currency: 'USD', amountMinor: '1000' },
    });
    await cartService.setCartItem(target._id, 'mercadozetta', product._id, 1);
    await watchlistService.addWatchlist(
      target._id,
      'mercadozetta',
      product._id,
    );
    const createdAt = new Date('2026-07-19T15:30:00.000Z');
    await db.insert(notifications).values({
      id: randomUUID(),
      tenantId: 'mercadozetta',
      userId: target._id,
      message: 'Must survive rollback',
      createdAt,
      updatedAt: createdAt,
    });
    const session = await postgresSessionService.createSession(
      target._id,
      'mercadozetta',
      0,
      'deactivation rollback browser',
      createdAt,
    );
    const tokenId = randomUUID();
    await accountTokenRepository.create({
      _id: tokenId,
      tenantId: 'mercadozetta',
      userId: target._id,
      purpose: 'password_reset',
      tokenHash: '8'.repeat(64),
      tokenHashSecretVersion: 'current',
      expiresAt: new Date('2026-07-19T16:30:00.000Z'),
      createdAt,
    });
    await pendingEmailChangeRepository.save({
      _id: randomUUID(),
      tenantId: 'mercadozetta',
      userId: target._id,
      email: 'deactivation-rollback-pending@example.com',
      emailVersion: 0,
      expiresAt: new Date('2026-07-19T16:00:00.000Z'),
      createdAt,
    });
    await pool.query(`
      create function reject_deactivation_audit() returns trigger
      language plpgsql as $$
      begin
        if new.event_type = 'user.deactivated' then
          raise exception 'forced deactivation audit failure';
        end if;
        return new;
      end;
      $$;
      create trigger reject_deactivation_audit_insert
      before insert on audit_events
      for each row execute function reject_deactivation_audit();
    `);
    try {
      await expect(
        accountDeactivationService().deactivateAccount(
          {
            currentPassword: userPayload.password,
            confirmation: 'DEACTIVATE',
          },
          target._id,
          'mercadozetta',
          new Date('2026-07-19T15:31:00.000Z'),
        ),
      ).rejects.toMatchObject({
        cause: {
          message: expect.stringContaining('forced deactivation audit failure'),
        },
      });
    } finally {
      await pool.query(`
        drop trigger reject_deactivation_audit_insert on audit_events;
        drop function reject_deactivation_audit();
      `);
    }

    const [storedTarget] = await db
      .select()
      .from(users)
      .where(eq(users.id, target._id));
    expect(storedTarget).toMatchObject({
      deactivatedAt: null,
      tokenVersion: 0,
      username: userPayload.username.toLowerCase(),
      telephone: userPayload.telephone.toLowerCase(),
    });
    await expect(
      bcrypt.compare(userPayload.password, storedTarget.passwordHash),
    ).resolves.toBe(true);
    await expect(
      productRepository.findById('mercadozetta', product._id),
    ).resolves.toMatchObject({ status: 'active' });
    await expect(
      postgresSessions.isActive(
        'mercadozetta',
        target._id,
        session.session.id,
        0,
        new Date('2026-07-19T15:32:00.000Z'),
      ),
    ).resolves.toBe(true);
    await expect(
      accountTokenRepository.findById('mercadozetta', tokenId),
    ).resolves.not.toHaveProperty('invalidatedAt');
    await expect(
      pendingEmailChangeRepository.findByUser('mercadozetta', target._id),
    ).resolves.toMatchObject({
      email: 'deactivation-rollback-pending@example.com',
    });
    expect(
      await db.select().from(carts).where(eq(carts.buyerId, target._id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(watchlistEntries)
        .where(eq(watchlistEntries.userId, target._id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, target._id)),
    ).toHaveLength(1);
  });

  it('verifies email and resets password with one-winner tokens and session revocation', async () => {
    const sender = new CapturingAccountMessageSender();
    const service = accountSecurityService(sender);
    const created = await userService.createUser(
      { ...userPayload, email: 'recovery@example.com' },
      'mercadozetta',
    );
    const verificationRequestedAt = new Date('2026-07-19T10:00:00.000Z');

    await expect(
      service.requestEmailVerification(
        { email: ' RECOVERY@EXAMPLE.COM ' },
        'mercadozetta',
        verificationRequestedAt,
      ),
    ).resolves.toMatchObject({ message: expect.any(String) });
    await flushAccountMessages();
    const verificationMessage = sender.messages[0];
    expect(verificationMessage).toMatchObject({
      kind: 'email_verification',
      tenantId: 'mercadozetta',
      userId: created._id,
      email: 'recovery@example.com',
    });
    if (!('token' in verificationMessage))
      throw new Error('Expected verification token message');

    const [storedVerification] = await db
      .select()
      .from(accountTokens)
      .where(eq(accountTokens.id, verificationMessage.token.split('.')[0]));
    expect(storedVerification.tokenHash).not.toContain(
      verificationMessage.token,
    );
    expect(storedVerification).not.toHaveProperty('token');

    const confirmations = await Promise.allSettled([
      service.confirmEmailVerification(
        { token: verificationMessage.token },
        'mercadozetta',
        new Date('2026-07-19T10:05:00.000Z'),
      ),
      service.confirmEmailVerification(
        { token: verificationMessage.token },
        'mercadozetta',
        new Date('2026-07-19T10:05:00.000Z'),
      ),
    ]);
    expect(
      confirmations.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      confirmations.filter(({ status }) => status === 'rejected'),
    ).toMatchObject([{ reason: { code: 'INVALID_OR_EXPIRED_ACCOUNT_TOKEN' } }]);
    await expect(
      userRepository.findForAccountSecurity(
        'mercadozetta',
        'recovery@example.com',
      ),
    ).resolves.toMatchObject({ emailVerifiedAt: expect.any(Date) });

    const session = await postgresSessionService.createSession(
      created._id,
      'mercadozetta',
      0,
      'recovery integration browser',
      new Date('2026-07-19T10:06:00.000Z'),
    );
    await service.requestPasswordReset(
      { email: 'recovery@example.com' },
      'mercadozetta',
      new Date('2026-07-19T10:10:00.000Z'),
    );
    await flushAccountMessages();
    const resetMessage = sender.messages.find(
      ({ kind }) => kind === 'password_reset',
    );
    if (!resetMessage || !('token' in resetMessage))
      throw new Error('Expected password reset token message');

    await expect(
      service.confirmPasswordReset(
        {
          token: resetMessage.token,
          password: 'replacement123',
          passwordConfirmation: 'replacement123',
        },
        'mercadozetta',
        new Date('2026-07-19T10:15:00.000Z'),
      ),
    ).resolves.toBeUndefined();
    await flushAccountMessages();

    const securityState = await userRepository.findForAccountSecurity(
      'mercadozetta',
      'recovery@example.com',
    );
    expect(securityState?.tokenVersion).toBe(1);
    await expect(
      bcrypt.compare('replacement123', securityState!.passwordHash),
    ).resolves.toBe(true);
    await expect(
      postgresSessions.isActive(
        'mercadozetta',
        created._id,
        session.session.id,
        0,
        new Date('2026-07-19T10:16:00.000Z'),
      ),
    ).resolves.toBe(false);
    expect(sender.messages).toContainEqual(
      expect.objectContaining({ kind: 'password_reset_notice' }),
    );
    expect(
      (await db.select().from(auditEvents))
        .filter(({ resourceId }) => resourceId === created._id)
        .map(({ eventType }) => eventType),
    ).toEqual(
      expect.arrayContaining([
        'user.email_verified',
        'user.password_reset',
        'session.revoked',
      ]),
    );
  });

  it('exposes account-security HTTP routes only when delivery is configured', async () => {
    await request(postgresApp)
      .post('/auth/email-verification/requests')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'unknown@example.com' })
      .expect(503)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: 'Account message delivery is unavailable',
          code: 'ACCOUNT_DELIVERY_UNAVAILABLE',
        });
      });

    const sender = new CapturingAccountMessageSender();
    const app = accountSecurityHttpApp(sender);
    await userService.createUser(
      { ...userPayload, email: 'http-recovery@example.com' },
      'mercadozetta',
    );

    await request(app)
      .post('/auth/email-verification/requests')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'HTTP-RECOVERY@EXAMPLE.COM' })
      .expect(202)
      .expect({
        message: 'If an eligible account exists, instructions will be sent.',
      });
    await flushAccountMessages();
    const verification = sender.messages.find(
      ({ kind }) => kind === 'email_verification',
    );
    if (!verification || !('token' in verification))
      throw new Error('Expected HTTP verification token message');

    await request(app)
      .post('/auth/email-verification/confirmations')
      .set('Origin', 'http://localhost:5173')
      .send({ token: verification.token })
      .expect(204);

    await request(app)
      .post('/auth/password-reset/requests')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'http-recovery@example.com' })
      .expect(202);
    await flushAccountMessages();
    const reset = sender.messages.find(({ kind }) => kind === 'password_reset');
    if (!reset || !('token' in reset))
      throw new Error('Expected HTTP password reset token message');

    const confirmation = await request(app)
      .post('/auth/password-reset/confirmations')
      .set('Origin', 'http://localhost:5173')
      .send({
        token: reset.token,
        password: 'replacement123',
        passwordConfirmation: 'replacement123',
      })
      .expect(204);
    expect(confirmation.headers['set-cookie']).toHaveLength(3);
  });

  it('serves the authenticated account-management lifecycle through cookies and CSRF', async () => {
    const sender = new CapturingAccountMessageSender();
    const app = accountSecurityHttpApp(sender);
    const registration = await request(app)
      .post('/users')
      .send({
        ...userPayload,
        email: 'http-account-management@example.com',
      })
      .expect(201);
    const login = await request(app)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'http-account-management@example.com',
        password: userPayload.password,
      })
      .expect(200);
    let auth = authCookies(login);

    await request(app)
      .patch('/account/profile')
      .set('Origin', 'http://localhost:5173')
      .send({ username: 'Missing session' })
      .expect(401);
    await request(app)
      .patch('/account/profile')
      .set('Cookie', auth.cookie)
      .set('Origin', 'http://localhost:5173')
      .send({ username: 'Missing CSRF' })
      .expect(403)
      .expect(({ body }) =>
        expect(body).toMatchObject({ code: 'INVALID_CSRF_TOKEN' }),
      );
    await request(app)
      .patch('/account/profile')
      .set('Cookie', auth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', auth.csrf!)
      .send({ username: ' HTTP Managed ', telephone: null })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          _id: registration.body._id,
          username: 'HTTP Managed',
          telephone: null,
        });
        expect(body).not.toHaveProperty('passwordHash');
      });

    await request(app)
      .post('/account/password-changes')
      .set('Cookie', auth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', auth.csrf!)
      .send({
        currentPassword: 'wrong-password',
        password: 'new-http-password',
        passwordConfirmation: 'new-http-password',
      })
      .expect(403)
      .expect(({ body }) =>
        expect(body).toMatchObject({ code: 'REAUTHENTICATION_FAILED' }),
      );
    const passwordChange = await request(app)
      .post('/account/password-changes')
      .set('Cookie', auth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', auth.csrf!)
      .send({
        currentPassword: userPayload.password,
        password: 'new-http-password',
        passwordConfirmation: 'new-http-password',
      })
      .expect(204);
    expect(passwordChange.headers['set-cookie']).toHaveLength(3);
    await request(app)
      .get('/auth/session')
      .set('Cookie', auth.cookie)
      .expect(401);

    const relogin = await request(app)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'http-account-management@example.com',
        password: 'new-http-password',
      })
      .expect(200);
    auth = authCookies(relogin);

    await request(postgresApp)
      .post('/account/email-changes')
      .set('Cookie', auth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', auth.csrf!)
      .send({
        email: 'http-account-management-new@example.com',
        currentPassword: 'new-http-password',
      })
      .expect(503)
      .expect(({ body }) =>
        expect(body).toMatchObject({ code: 'ACCOUNT_DELIVERY_UNAVAILABLE' }),
      );
    await request(app)
      .post('/account/email-changes')
      .set('Cookie', auth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', auth.csrf!)
      .send({
        email: ' HTTP-ACCOUNT-MANAGEMENT-NEW@EXAMPLE.COM ',
        currentPassword: 'new-http-password',
      })
      .expect(202)
      .expect({
        message:
          'If the address can be used, confirmation instructions will be sent.',
      });
    await flushAccountMessages();
    const emailChange = sender.messages.find(
      ({ kind }) => kind === 'email_change',
    );
    if (!emailChange || !('token' in emailChange))
      throw new Error('Expected HTTP email-change token message');

    await request(app)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'http-account-management@example.com',
        password: 'new-http-password',
      })
      .expect(200);
    const emailConfirmation = await request(app)
      .post('/auth/email-change/confirmations')
      .set('Origin', 'http://localhost:5173')
      .send({ token: emailChange.token })
      .expect(204);
    expect(emailConfirmation.headers['set-cookie']).toHaveLength(3);
    await request(app)
      .get('/auth/session')
      .set('Cookie', auth.cookie)
      .expect(401);
    await request(app)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'http-account-management@example.com',
        password: 'new-http-password',
      })
      .expect(401);

    const newEmailLogin = await request(app)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'http-account-management-new@example.com',
        password: 'new-http-password',
      })
      .expect(200);
    auth = authCookies(newEmailLogin);
    const deactivation = await request(app)
      .post('/account/deactivation')
      .set('Cookie', auth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', auth.csrf!)
      .send({
        currentPassword: 'new-http-password',
        confirmation: 'DEACTIVATE',
      })
      .expect(204);
    expect(deactivation.headers['set-cookie']).toHaveLength(3);
    await request(app)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'http-account-management-new@example.com',
        password: 'new-http-password',
      })
      .expect(401);
    await request(app).get(`/users/${registration.body._id}`).expect(404);
  });

  it('rolls back reset token, password, and sessions when audit insertion fails', async () => {
    const sender = new CapturingAccountMessageSender();
    const service = accountSecurityService(sender);
    const created = await userService.createUser(
      { ...userPayload, email: 'rollback-recovery@example.com' },
      'mercadozetta',
    );
    const session = await postgresSessionService.createSession(
      created._id,
      'mercadozetta',
      0,
      'rollback integration browser',
      new Date('2026-07-19T11:00:00.000Z'),
    );
    await service.requestPasswordReset(
      { email: 'rollback-recovery@example.com' },
      'mercadozetta',
      new Date('2026-07-19T11:01:00.000Z'),
    );
    await flushAccountMessages();
    const resetMessage = sender.messages.find(
      ({ kind }) => kind === 'password_reset',
    );
    if (!resetMessage || !('token' in resetMessage))
      throw new Error('Expected password reset token message');

    await pool.query(`
      create function reject_password_reset_audit() returns trigger
      language plpgsql as $$
      begin
        if new.event_type = 'user.password_reset' then
          raise exception 'forced account audit failure';
        end if;
        return new;
      end;
      $$;
      create trigger reject_password_reset_audit_insert
      before insert on audit_events
      for each row execute function reject_password_reset_audit();
    `);
    try {
      await expect(
        service.confirmPasswordReset(
          {
            token: resetMessage.token,
            password: 'must-not-commit',
            passwordConfirmation: 'must-not-commit',
          },
          'mercadozetta',
          new Date('2026-07-19T11:05:00.000Z'),
        ),
      ).rejects.toMatchObject({
        cause: {
          message: expect.stringContaining('forced account audit failure'),
        },
      });
    } finally {
      await pool.query(`
        drop trigger reject_password_reset_audit_insert on audit_events;
        drop function reject_password_reset_audit();
      `);
    }

    const state = await userRepository.findForAccountSecurity(
      'mercadozetta',
      'rollback-recovery@example.com',
    );
    expect(state?.tokenVersion).toBe(0);
    await expect(
      bcrypt.compare(userPayload.password, state!.passwordHash),
    ).resolves.toBe(true);
    await expect(
      postgresSessions.isActive(
        'mercadozetta',
        created._id,
        session.session.id,
        0,
        new Date('2026-07-19T11:06:00.000Z'),
      ),
    ).resolves.toBe(true);
    const [storedReset] = await db
      .select({ consumedAt: accountTokens.consumedAt })
      .from(accountTokens)
      .where(eq(accountTokens.id, resetMessage.token.split('.')[0]));
    expect(storedReset.consumedAt).toBeNull();
  });

  it('enforces tenant ownership and maps product rows to the current API shape', async () => {
    const seller = await userService.createUser(userPayload, 'mercadozetta');
    const otherTenantSeller = await userService.createUser(
      { ...userPayload, email: 'campus-seller@example.com' },
      'campus-market',
    );
    const productKey = randomUUID();
    const productInput = {
      name: ' Keyboard ',
      description: 'Mechanical keyboard',
      inventory: 2,
      price: { currency: 'USD', amountMinor: '7500' },
      image: 'keyboard.png',
    };
    const product = await productService.createProduct(
      productInput,
      seller._id,
      'mercadozetta',
      productKey,
    );
    await expect(
      productService.createProduct(
        productInput,
        seller._id,
        'mercadozetta',
        productKey,
      ),
    ).resolves.toMatchObject({ _id: product._id });
    await expect(
      productService.createProduct(
        {
          ...productInput,
          inventory: 3,
        },
        seller._id,
        'mercadozetta',
        productKey,
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    expect(
      await db.select().from(products).where(eq(products.sellerId, seller._id)),
    ).toHaveLength(1);

    expect(isUuid(product._id)).toBe(true);
    expect(product).toMatchObject({
      tenantId: 'mercadozetta',
      seller: seller._id,
      name: 'keyboard',
      image: 'keyboard.png',
      inventory: 2,
      price: { currency: 'USD', amountMinor: '7500' },
      status: 'active',
    });
    expect(
      await db
        .select()
        .from(productPriceHistory)
        .where(eq(productPriceHistory.productId, product._id)),
    ).toHaveLength(1);
    await productService.updateProduct(
      product._id,
      { price: { currency: 'USD', amountMinor: '8000' } },
      seller._id,
      'mercadozetta',
    );
    await productService.updateProduct(
      product._id,
      { price: { currency: 'USD', amountMinor: '8000' } },
      seller._id,
      'mercadozetta',
    );
    expect(
      await db
        .select()
        .from(productPriceHistory)
        .where(eq(productPriceHistory.productId, product._id)),
    ).toHaveLength(2);
    await expect(
      productService.getProductById(product._id, 'campus-market'),
    ).resolves.toBeNull();
    await expect(
      productService.listProductsBySeller(seller._id, 'mercadozetta'),
    ).resolves.toMatchObject({
      items: [{ _id: product._id, seller: seller._id }],
    });

    try {
      await productService.createProduct(
        {
          name: 'Desk',
          inventory: 1,
          price: { currency: 'USD', amountMinor: '10000' },
          image: 'desk.png',
        },
        otherTenantSeller._id,
        'mercadozetta',
        randomUUID(),
      );
      throw new Error('Expected cross-tenant product ownership to fail');
    } catch (error) {
      expect(error).toMatchObject({ cause: { code: '23503' } });
    }
  });

  it('filters and sorts tenant catalog rows in PostgreSQL', async () => {
    const seller = await userService.createUser(userPayload, 'mercadozetta');
    const otherSeller = await userService.createUser(
      { ...userPayload, email: 'other-seller@example.com' },
      'mercadozetta',
    );
    const campusSeller = await userService.createUser(
      { ...userPayload, email: 'campus-catalog@example.com' },
      'campus-market',
    );

    const keyboard = await productService.createProduct(
      {
        name: 'Keyboard',
        description: 'Mechanical switches',
        category: 'Peripherals',
        subcategory: 'Keyboards',
        inventory: 3,
        price: { currency: 'USD', amountMinor: '7500' },
        image: 'keyboard.png',
      },
      seller._id,
      'mercadozetta',
      randomUUID(),
    );
    const cable = await productService.createProduct(
      {
        name: 'Cable',
        description: 'Braided with 100% recycled fibers',
        category: 'Peripherals',
        subcategory: 'Cables',
        inventory: 0,
        price: { currency: 'USD', amountMinor: '1500' },
        image: 'cable.png',
        status: 'sold_out',
      },
      seller._id,
      'mercadozetta',
      randomUUID(),
    );
    const desk = await productService.createProduct(
      {
        name: 'Desk',
        description: 'Standing desk',
        category: 'Furniture',
        subcategory: 'Desks',
        inventory: 5,
        price: { currency: 'USD', amountMinor: '25000' },
        image: 'desk.png',
        status: 'paused',
      },
      seller._id,
      'mercadozetta',
      randomUUID(),
    );
    const mouse = await productService.createProduct(
      {
        name: 'Mouse',
        category: 'Peripherals',
        inventory: 9,
        price: { currency: 'USD', amountMinor: '2500' },
        image: 'mouse.png',
      },
      otherSeller._id,
      'mercadozetta',
      randomUUID(),
    );
    await productService.createProduct(
      {
        name: 'Campus keyboard',
        category: 'Peripherals',
        inventory: 99,
        price: { currency: 'USD', amountMinor: '6000' },
        image: 'campus-keyboard.png',
      },
      campusSeller._id,
      'campus-market',
      randomUUID(),
    );

    const creationTimes = [
      [keyboard._id, '2025-01-01T00:00:00.000Z'],
      [cable._id, '2025-01-02T00:00:00.000Z'],
      [desk._id, '2025-01-03T00:00:00.000Z'],
      [mouse._id, '2025-01-04T00:00:00.000Z'],
    ] as const;
    for (const [id, createdAt] of creationTimes)
      await db
        .update(products)
        .set({ createdAt: new Date(createdAt) })
        .where(eq(products.id, id));

    await expect(
      productService.listProducts('mercadozetta', {
        q: 'MECHANICAL',
        category: 'PERIPHERALS',
        subcategory: 'KEYBOARDS',
        seller: seller._id,
        status: 'active',
        availability: 'in_stock',
        sort: 'name_asc',
      }),
    ).resolves.toMatchObject({ items: [{ _id: keyboard._id }] });
    await expect(
      productService.listProducts('mercadozetta', {
        q: '100%',
        availability: 'sold_out',
      }),
    ).resolves.toMatchObject({ items: [{ _id: cable._id }] });
    await expect(
      productService.listProducts('mercadozetta', {
        status: 'paused',
      }),
    ).resolves.toMatchObject({ items: [{ _id: desk._id }] });

    const inventoryOrder = await productService.listProducts('mercadozetta', {
      sort: 'inventory_desc',
    });
    expect(inventoryOrder.items.map(({ _id }) => _id)).toEqual([
      mouse._id,
      desk._id,
      keyboard._id,
      cable._id,
    ]);
    const oldestFirst = await productService.listProducts('mercadozetta', {
      sort: 'created_asc',
    });
    expect(oldestFirst.items.map(({ _id }) => _id)).toEqual([
      keyboard._id,
      cable._id,
      desk._id,
      mouse._id,
    ]);
    const newestFirst = await productService.listProducts('mercadozetta');
    expect(newestFirst.items.map(({ _id }) => _id)).toEqual([
      mouse._id,
      desk._id,
      cable._id,
      keyboard._id,
    ]);
    await expect(
      productService.listProductsBySeller(seller._id, 'mercadozetta', {
        status: 'active',
      }),
    ).resolves.toMatchObject({ items: [{ _id: keyboard._id }] });

    const firstInventoryPage = await productService.listProducts(
      'mercadozetta',
      { sort: 'inventory_desc', limit: 2, offset: 0 },
    );
    expect(firstInventoryPage).toMatchObject({
      items: [{ _id: mouse._id }, { _id: desk._id }],
      page: { limit: 2, offset: 0, total: 4, hasMore: true },
    });
    const secondInventoryPage = await productService.listProducts(
      'mercadozetta',
      { sort: 'inventory_desc', limit: 2, offset: 2 },
    );
    expect(secondInventoryPage).toMatchObject({
      items: [{ _id: keyboard._id }, { _id: cable._id }],
      page: { limit: 2, offset: 2, total: 4, hasMore: false },
    });

    const catalogIndexes = await pool.query<{ indexname: string }>(
      "select indexname from pg_indexes where tablename = 'products'",
    );
    expect(catalogIndexes.rows.map(({ indexname }) => indexname)).toEqual(
      expect.arrayContaining([
        'products_catalog_idx',
        'products_seller_idx',
        'products_category_idx',
        'products_name_idx',
        'products_inventory_idx',
      ]),
    );
  });

  it('enforces seller-owned product management and inventory lifecycle rules', async () => {
    await request(postgresApp)
      .get('/users/not-a-uuid')
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'INVALID_SELLER_ID' });
      });

    const sellerRegistration = await request(postgresApp)
      .post('/users')
      .send(userPayload)
      .expect(201);
    const attackerEmail = 'product-attacker@example.com';
    await request(postgresApp)
      .post('/users')
      .send({ ...userPayload, email: attackerEmail, username: 'Attacker' })
      .expect(201);
    const sellerLogin = await request(postgresApp)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: userPayload.email, password: userPayload.password })
      .expect(200);
    const attackerLogin = await request(postgresApp)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: attackerEmail, password: userPayload.password })
      .expect(200);
    const sellerAuth = authCookies(sellerLogin);
    const attackerAuth = authCookies(attackerLogin);
    const created = await request(postgresApp)
      .post('/products')
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .set('Idempotency-Key', randomUUID())
      .send({
        name: 'Managed',
        inventory: 2,
        price: { currency: 'USD', amountMinor: '4500' },
        image: 'managed.png',
      })
      .expect(201);
    const productId = created.body._id;

    await request(postgresApp)
      .patch(`/products/${productId}`)
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({
        name: 'Updated managed',
        category: 'Office',
        seller: attackerLogin.body.user._id,
        tenantId: 'campus-market',
        inventory: 999,
        status: 'archived',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          name: 'updated managed',
          category: 'office',
          seller: sellerRegistration.body._id,
          tenantId: 'mercadozetta',
          inventory: 2,
          status: 'active',
        });
      });

    await request(postgresApp)
      .patch(`/products/${productId}`)
      .set('Cookie', attackerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', attackerAuth.csrf!)
      .send({ name: 'Stolen' })
      .expect(403);

    await request(postgresApp)
      .patch(`/products/${productId}/inventory`)
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({ inventory: 0 })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ inventory: 0, status: 'sold_out' }),
      );
    await request(postgresApp)
      .patch(`/products/${productId}/status`)
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({ status: 'active' })
      .expect(409);
    await request(postgresApp)
      .patch(`/products/${productId}/inventory`)
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({ inventory: 4 })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ inventory: 4, status: 'active' }),
      );
    await request(postgresApp)
      .patch(`/products/${productId}/status`)
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({ status: 'archived' })
      .expect(200);
    await request(postgresApp)
      .patch(`/products/${productId}/status`)
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .send({ status: 'active' })
      .expect(200);

    const inventoryEvents = (await db.select().from(auditEvents)).filter(
      (event) =>
        event.resourceId === productId && event.eventType === 'inventory.set',
    );
    expect(inventoryEvents).toMatchObject([
      {
        actorId: sellerRegistration.body._id,
        resourceType: 'product',
        metadata: { previousInventory: 2, nextInventory: 0 },
      },
      {
        actorId: sellerRegistration.body._id,
        resourceType: 'product',
        metadata: { previousInventory: 0, nextInventory: 4 },
      },
    ]);
    await expect(
      db
        .update(auditEvents)
        .set({ eventType: 'inventory.set' })
        .where(eq(auditEvents.id, inventoryEvents[0].id)),
    ).rejects.toMatchObject({ cause: { code: '55000' } });
    await expect(
      db.delete(auditEvents).where(eq(auditEvents.id, inventoryEvents[0].id)),
    ).rejects.toMatchObject({ cause: { code: '55000' } });

    await expect(
      transactionCoordinator.run(async ({ products, audits }) => {
        await products.updateOwned(
          'mercadozetta',
          productId,
          sellerRegistration.body._id,
          { inventory: 1 },
        );
        await audits.append({
          tenantId: 'mercadozetta',
          eventType: 'invalid.event' as AuditEventType,
          actorId: sellerRegistration.body._id,
          resourceType: 'product',
          resourceId: productId,
          occurredAt: new Date(),
        });
      }),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      productRepository.findById('mercadozetta', productId),
    ).resolves.toMatchObject({ inventory: 4 });
  });

  it('serves the existing HTTP contract through one PostgreSQL composition', async () => {
    const sellerRegistration = await request(postgresApp)
      .post('/users')
      .send(userPayload)
      .expect(201);
    const sellerId = sellerRegistration.body._id;
    const login = await request(postgresApp)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: userPayload.email, password: userPayload.password })
      .expect(200);
    const sellerAuth = authCookies(login);
    expect(login.body).toMatchObject({
      user: { _id: sellerId, tenantId: 'mercadozetta' },
      session: { id: expect.any(String) },
    });
    expect(login.body).not.toHaveProperty('accessToken');
    expect(sellerAuth.csrf).toBeTruthy();

    const createdProduct = await request(postgresApp)
      .post('/products')
      .set('Cookie', sellerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', sellerAuth.csrf!)
      .set('Idempotency-Key', randomUUID())
      .send({
        name: 'HTTP PostgreSQL product',
        description: 'Created through composed routes',
        inventory: 2,
        price: { currency: 'USD', amountMinor: '4500' },
        image: 'postgres-http.png',
      })
      .expect(201);
    const productId = createdProduct.body._id;
    await request(postgresApp)
      .get(`/products/${productId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          _id: productId,
          seller: sellerId,
          sellerProfile: { _id: sellerId },
        });
      });

    const buyerEmail = 'http-buyer@example.com';
    await request(postgresApp)
      .post('/users')
      .send({ ...userPayload, email: buyerEmail, username: 'Buyer' })
      .expect(201);
    const buyerLogin = await request(postgresApp)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: buyerEmail, password: userPayload.password })
      .expect(200);
    const buyerAuth = authCookies(buyerLogin);
    await request(postgresApp)
      .put('/cart/items')
      .set('Cookie', buyerAuth.cookie)
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', buyerAuth.csrf!)
      .send({ productId, quantity: 1 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          tenantId: 'mercadozetta',
          buyer: buyerLogin.body.user._id,
          items: [{ product: { _id: productId }, quantity: 1 }],
        });
        expect(body).not.toHaveProperty('_id');
      });
    await request(postgresApp)
      .get('/ready')
      .expect(200, {
        status: 'ready',
        checks: { postgresql: 'connected' },
      });
  });

  it('authenticates, restores state, and invalidates tokens through PostgreSQL', async () => {
    const user = await userService.createUser(userPayload, 'mercadozetta');
    const sessionDependencies: AuthSessionService = {
      createSession: vi.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        csrfToken: 'csrf-token',
        session: { id: 'session-1' },
      }),
      getSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
      revokeAllSessions: vi.fn().mockResolvedValue(undefined),
    };
    const authService = createAuthService(userRepository, sessionDependencies);

    const authenticated = await authService.authenticate(
      { email: ' SELLER@EXAMPLE.COM ', password: 'secret123' },
      'mercadozetta',
      'PostgreSQL integration',
    );
    expect(authenticated.user).toMatchObject({
      _id: user._id,
      tenantId: 'mercadozetta',
      email: 'seller@example.com',
    });
    expect(authenticated.user).not.toHaveProperty('passwordHash');
    expect(authenticated.user).not.toHaveProperty('tokenVersion');
    expect(sessionDependencies.createSession).toHaveBeenCalledWith(
      user._id,
      'mercadozetta',
      0,
      'PostgreSQL integration',
      expect.any(Date),
    );

    await expect(
      authService.getSessionState('session-1', user._id, 'mercadozetta'),
    ).resolves.toMatchObject({
      user: { _id: user._id, email: 'seller@example.com' },
      session: { id: 'session-1' },
    });
    await expect(
      userRepository.hasTokenVersion('mercadozetta', user._id, 0),
    ).resolves.toBe(true);

    await authService.logout(user._id, 'mercadozetta');
    await expect(
      userRepository.hasTokenVersion('mercadozetta', user._id, 0),
    ).resolves.toBe(false);
    await expect(
      userRepository.findTokenVersion('mercadozetta', user._id),
    ).resolves.toBe(1);
    expect(sessionDependencies.revokeAllSessions).toHaveBeenCalledWith(
      user._id,
      'mercadozetta',
      expect.any(Date),
    );
  });

  it('preserves session rotation, replay, revocation, and cleanup semantics', async () => {
    const user = await userService.createUser(userPayload, 'mercadozetta');
    const now = new Date('2026-07-15T12:00:00.000Z');
    const created = await postgresSessionService.createSession(
      user._id,
      'mercadozetta',
      0,
      `${'PostgreSQL browser '.repeat(10)}\r\nInjected`,
      now,
    );

    const [stored] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, created.session.id));
    expect(stored.refreshTokenHash).not.toBe(created.refreshToken);
    expect(stored.refreshTokenSecretVersion).toBe('current');
    expect(stored.userAgentLabel).not.toContain('\n');
    expect(stored.userAgentLabel).toHaveLength(120);
    await expect(
      postgresSessionService.getSession(
        created.session.id,
        user._id,
        'mercadozetta',
        now,
      ),
    ).resolves.toMatchObject({ id: created.session.id });
    await expect(
      postgresSessionService.listSessions(user._id, 'campus-market', now),
    ).resolves.toEqual([]);
    await expect(
      postgresSessionService.rotateSession(
        created.refreshToken,
        'campus-market',
        now,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });

    const refreshAt = new Date(now.getTime() + 1000);
    const attempts = await Promise.allSettled([
      postgresSessionService.rotateSession(
        created.refreshToken,
        'mercadozetta',
        refreshAt,
      ),
      postgresSessionService.rotateSession(
        created.refreshToken,
        'mercadozetta',
        refreshAt,
      ),
    ]);
    expect(
      attempts.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter(({ status }) => status === 'rejected'),
    ).toMatchObject([
      { reason: { statusCode: 409, code: 'REFRESH_ALREADY_ROTATED' } },
    ]);
    expect(
      (await db.select().from(sessions).where(eq(sessions.id, stored.id)))[0],
    ).toMatchObject({
      rotationCounter: 1,
      previousRefreshTokenHash: stored.refreshTokenHash,
      previousRefreshTokenSecretVersion: 'current',
      revokedAt: null,
    });

    await expect(
      postgresSessionService.rotateSession(
        created.refreshToken,
        'mercadozetta',
        new Date(now.getTime() + 7000),
      ),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'REFRESH_TOKEN_REUSED',
    });
    await expect(
      postgresSessions.isActive(
        'mercadozetta',
        user._id,
        created.session.id,
        0,
        refreshAt,
      ),
    ).resolves.toBe(false);

    const revocable = await postgresSessionService.createSession(
      user._id,
      'mercadozetta',
      0,
      undefined,
      now,
    );
    await postgresSessionService.revokeSession(
      revocable.session.id,
      user._id,
      'mercadozetta',
      'user_revoked',
      now,
    );
    await expect(
      postgresSessionService.revokeSession(
        revocable.session.id,
        user._id,
        'mercadozetta',
        'user_revoked',
        now,
      ),
    ).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });

    const allSessions = await postgresSessionService.createSession(
      user._id,
      'mercadozetta',
      0,
      undefined,
      now,
    );
    await postgresSessionService.revokeAllSessions(
      user._id,
      'mercadozetta',
      now,
    );
    await expect(
      postgresSessions.isActive(
        'mercadozetta',
        user._id,
        allSessions.session.id,
        0,
        now,
      ),
    ).resolves.toBe(false);
    const sessionEvents = (await db.select().from(auditEvents)).filter(
      ({ resourceType, actorId }) =>
        (resourceType === 'session' || resourceType === 'user') &&
        actorId === user._id,
    );
    expect(sessionEvents.map(({ eventType }) => eventType)).toEqual(
      expect.arrayContaining([
        'session.created',
        'session.rotated',
        'session.reuse_detected',
        'session.revoked',
      ]),
    );
    expect(
      sessionEvents.every(
        ({ metadata }) =>
          !metadata ||
          Object.keys(metadata).every(
            (key) => !/password|token|cookie|csrf|hash/i.test(key),
          ),
      ),
    ).toBe(true);
    await expect(
      postgresSessionService.deleteExpiredSessions(new Date('2099-01-01')),
    ).resolves.toBe(3);
  });

  it('rolls back inventory and serializes concurrent final-unit reservations', async () => {
    const seller = await userService.createUser(userPayload, 'mercadozetta');
    const product = await productRepository.create({
      tenantId: 'mercadozetta',
      seller: seller._id,
      name: 'Final unit',
      description: '',
      category: 'general',
      subcategory: '',
      inventory: 1,
      image: 'final-unit.png',
      status: 'active',
      price: { currency: 'USD', amountMinor: '1000' },
    });

    await expect(
      db.transaction(async (transaction) => {
        const repository = new PostgresProductRepository(transaction);
        const [locked] = await repository.findByIdsForUpdate('mercadozetta', [
          product._id,
        ]);
        expect(locked.inventory).toBe(1);
        await expect(
          repository.decrementAvailableInventory(
            'mercadozetta',
            product._id,
            1,
          ),
        ).resolves.toBe(true);
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');
    await expect(
      productRepository.findById('mercadozetta', product._id),
    ).resolves.toMatchObject({ inventory: 1 });

    const reserveFinalUnit = () =>
      db.transaction(async (transaction) => {
        const repository = new PostgresProductRepository(transaction);
        const [locked] = await repository.findByIdsForUpdate('mercadozetta', [
          product._id,
        ]);
        if (!locked || locked.status !== 'active' || locked.inventory < 1)
          return false;
        return repository.decrementAvailableInventory(
          'mercadozetta',
          product._id,
          1,
        );
      });

    await expect(
      Promise.all([reserveFinalUnit(), reserveFinalUnit()]),
    ).resolves.toEqual(expect.arrayContaining([true, false]));
    await expect(
      productRepository.findById('mercadozetta', product._id),
    ).resolves.toMatchObject({ inventory: 0 });
  });

  it('scopes seller operations, inventory history, summaries, and order filters', async () => {
    const seller = await userService.createUser(userPayload, 'mercadozetta');
    const buyer = await userService.createUser(
      { ...userPayload, email: 'operations-buyer@example.com' },
      'mercadozetta',
    );
    const product = await productService.createProduct(
      {
        name: 'Operations keyboard',
        inventory: 4,
        price: { currency: 'USD', amountMinor: '8500' },
        image: 'operations-keyboard.png',
      },
      seller._id,
      'mercadozetta',
      randomUUID(),
    );
    await productService.updateProductInventory(
      product._id,
      { inventory: 2 },
      seller._id,
      'mercadozetta',
    );
    const orderId = randomUUID();
    const now = new Date();
    await db.insert(orders).values({
      id: orderId,
      tenantId: 'mercadozetta',
      buyerId: buyer._id,
      checkoutIdempotencyKey: randomUUID(),
      status: 'confirmed',
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(orderItems).values({
      id: randomUUID(),
      tenantId: 'mercadozetta',
      orderId,
      productId: product._id,
      sellerId: seller._id,
      productName: product.name,
      quantity: 3,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      sellerOperationsService.getSellerOperations(seller._id, 'mercadozetta', {
        lowStockThreshold: 2,
        limit: 20,
        offset: 0,
      }),
    ).resolves.toMatchObject({
      summary: {
        productCount: 1,
        activeProductCount: 1,
        lowStockProductCount: 1,
        inventoryUnits: 2,
        orderCount: 1,
        openOrderCount: 1,
        orderedUnits: 3,
        pricedOrderCount: 0,
        legacyUnpricedOrderCount: 1,
        grossRevenue: { currency: 'USD', amountMinor: '0' },
      },
      lowStockProducts: [{ _id: product._id, inventory: 2 }],
      inventoryHistory: {
        items: [
          {
            eventType: 'inventory.set',
            product: product._id,
            previousInventory: 4,
            nextInventory: 2,
          },
        ],
        page: { total: 1 },
      },
    });
    await expect(
      sellerOperationsService.getSellerOperations(seller._id, 'campus-market', {
        lowStockThreshold: 2,
        limit: 20,
        offset: 0,
      }),
    ).resolves.toMatchObject({
      summary: {
        productCount: 0,
        orderCount: 0,
        pricedOrderCount: 0,
        legacyUnpricedOrderCount: 0,
        grossRevenue: { currency: 'USD', amountMinor: '0' },
      },
    });
    await expect(
      orderService.listOrders(seller._id, 'mercadozetta', {
        limit: 20,
        offset: 0,
        scope: 'seller',
        status: 'confirmed',
        q: 'keyboard',
      }),
    ).resolves.toMatchObject({ items: [{ _id: orderId }], page: { total: 1 } });
    await expect(
      orderService.listOrders(seller._id, 'mercadozetta', {
        limit: 20,
        offset: 0,
        scope: 'seller',
        status: 'delivered',
        q: '',
      }),
    ).resolves.toMatchObject({ items: [], page: { total: 0 } });
  });

  it('commits one complete checkout for two concurrent final-unit buyers', async () => {
    const seller = await userService.createUser(userPayload, 'mercadozetta');
    const firstBuyer = await userService.createUser(
      { ...userPayload, email: 'first-buyer@example.com' },
      'mercadozetta',
    );
    const secondBuyer = await userService.createUser(
      { ...userPayload, email: 'second-buyer@example.com' },
      'mercadozetta',
    );
    const product = await productRepository.create({
      tenantId: 'mercadozetta',
      seller: seller._id,
      name: 'Concurrent final unit',
      description: '',
      category: 'general',
      subcategory: '',
      inventory: 1,
      image: 'final-unit.png',
      status: 'active',
      price: { currency: 'USD', amountMinor: '1000' },
    });
    const buyerCarts = await Promise.all(
      [firstBuyer, secondBuyer].map(async (buyer) => {
        const cartId = randomUUID();
        const now = new Date();
        await db.insert(carts).values({
          id: cartId,
          tenantId: 'mercadozetta',
          buyerId: buyer._id,
          createdAt: now,
          updatedAt: now,
        });
        await db.insert(cartItems).values({
          tenantId: 'mercadozetta',
          cartId,
          productId: product._id,
          quantity: 1,
        });
        return { buyerId: buyer._id, cartId, idempotencyKey: randomUUID() };
      }),
    );

    const attempts = await Promise.allSettled(
      buyerCarts.map(({ buyerId, idempotencyKey }) =>
        checkoutService.createOrder(buyerId, 'mercadozetta', idempotencyKey),
      ),
    );
    expect(
      attempts.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter(({ status }) => status === 'rejected'),
    ).toMatchObject([
      {
        reason: {
          statusCode: 409,
          code: 'INSUFFICIENT_INVENTORY',
        },
      },
    ]);
    const placedOrder = attempts.find(
      (attempt) => attempt.status === 'fulfilled',
    );
    expect(placedOrder?.status).toBe('fulfilled');
    if (placedOrder?.status !== 'fulfilled')
      throw new Error('Expected one placed order');
    expect(placedOrder.value).toMatchObject({
      tenantId: 'mercadozetta',
      status: 'placed',
      pricingState: 'priced',
      subtotal: { currency: 'USD', amountMinor: '1000' },
      discount: { currency: 'USD', amountMinor: '0' },
      shipping: { currency: 'USD', amountMinor: '0' },
      total: { currency: 'USD', amountMinor: '1000' },
      items: [
        {
          tenantId: 'mercadozetta',
          order: placedOrder.value._id,
          product: product._id,
          seller: seller._id,
          productName: 'concurrent final unit',
          quantity: 1,
          pricingState: 'priced',
          unitPrice: { currency: 'USD', amountMinor: '1000' },
          lineSubtotal: { currency: 'USD', amountMinor: '1000' },
        },
      ],
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });

    const [
      storedProduct,
      storedOrders,
      storedItems,
      storedHistory,
      notices,
      checkoutAudits,
    ] = await Promise.all([
      productRepository.findById('mercadozetta', product._id),
      db.select().from(orders),
      db.select().from(orderItems),
      db.select().from(orderStatusHistory),
      db.select().from(notifications),
      db.select().from(auditEvents),
    ]);
    expect(storedProduct?.inventory).toBe(0);
    expect(storedOrders).toHaveLength(1);
    expect(storedOrders[0]).toMatchObject({
      pricingState: 'priced',
      currencyCode: 'USD',
      currencyMinorUnit: 2,
      subtotalMinor: 1000n,
      discountMinor: 0n,
      shippingMinor: 0n,
      totalMinor: 1000n,
    });
    expect(storedItems).toMatchObject([
      {
        orderId: storedOrders[0].id,
        productId: product._id,
        sellerId: seller._id,
        productName: 'concurrent final unit',
        quantity: 1,
        pricingState: 'priced',
        unitPriceMinor: 1000n,
        lineSubtotalMinor: 1000n,
      },
    ]);
    expect(storedHistory).toMatchObject([
      {
        orderId: storedOrders[0].id,
        sequence: 1,
        status: 'placed',
        actorId: storedOrders[0].buyerId,
      },
    ]);
    expect(notices).toHaveLength(2);
    expect(notices.map(({ userId }) => userId).sort()).toEqual(
      [seller._id, storedOrders[0].buyerId].sort(),
    );
    expect(checkoutAudits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'order.placed',
          actorId: storedOrders[0].buyerId,
          resourceType: 'order',
          resourceId: storedOrders[0].id,
        }),
        expect.objectContaining({
          eventType: 'inventory.decremented',
          actorId: storedOrders[0].buyerId,
          resourceType: 'product',
          resourceId: product._id,
          metadata: expect.objectContaining({ orderId: storedOrders[0].id }),
        }),
      ]),
    );

    const winningAttempt = buyerCarts.find(
      ({ buyerId }) => buyerId === storedOrders[0].buyerId,
    )!;
    await productService.updateProduct(
      product._id,
      { price: { currency: 'USD', amountMinor: '2500' } },
      seller._id,
      'mercadozetta',
    );
    await expect(
      checkoutService.createOrder(
        winningAttempt.buyerId,
        'mercadozetta',
        winningAttempt.idempotencyKey,
      ),
    ).resolves.toEqual(placedOrder.value);
    await expect(
      sellerOperationsService.getSellerOperations(seller._id, 'mercadozetta', {
        lowStockThreshold: 2,
        limit: 20,
        offset: 0,
      }),
    ).resolves.toMatchObject({
      summary: {
        pricedOrderCount: 1,
        legacyUnpricedOrderCount: 0,
        grossRevenue: { currency: 'USD', amountMinor: '1000' },
      },
    });
    await expect(
      Promise.all([
        db.select().from(orders),
        db.select().from(orderItems),
        db.select().from(notifications),
        db.select().from(auditEvents),
      ]),
    ).resolves.toMatchObject([
      { length: 1 },
      { length: 1 },
      { length: 2 },
      { length: 2 },
    ]);

    const remainingCartItems = await db.select().from(cartItems);
    const winningCart = buyerCarts.find(
      ({ buyerId }) => buyerId === storedOrders[0].buyerId,
    );
    const losingCart = buyerCarts.find(
      ({ buyerId }) => buyerId !== storedOrders[0].buyerId,
    );
    expect(
      remainingCartItems.some(({ cartId }) => cartId === winningCart?.cartId),
    ).toBe(false);
    expect(
      remainingCartItems.some(({ cartId }) => cartId === losingCart?.cartId),
    ).toBe(true);

    await expect(
      orderService.listOrders(seller._id, 'mercadozetta', firstPage),
    ).resolves.toMatchObject({
      items: [
        {
          _id: storedOrders[0].id,
          items: [{ product: product._id, seller: seller._id }],
        },
      ],
      page: { limit: 20, offset: 0, total: 1, hasMore: false },
    });
    await expect(
      orderService.listOrders(losingCart!.buyerId, 'mercadozetta', firstPage),
    ).resolves.toMatchObject({ items: [] });
    const advancedOrder = await orderService.updateOrderStatus(
      seller._id,
      'mercadozetta',
      storedOrders[0].id,
      'confirmed',
    );
    expect(advancedOrder).toMatchObject({
      status: 'confirmed',
      items: [{ product: product._id, seller: seller._id }],
    });
    await expect(
      orderService.updateOrderStatus(
        seller._id,
        'mercadozetta',
        storedOrders[0].id,
        'confirmed',
      ),
    ).resolves.toEqual(advancedOrder);
    const orderStatusAudits = (await db.select().from(auditEvents)).filter(
      ({ eventType }) => eventType === 'order.status_changed',
    );
    expect(orderStatusAudits).toEqual([
      expect.objectContaining({
        actorId: seller._id,
        resourceId: storedOrders[0].id,
        metadata: { previousStatus: 'placed', nextStatus: 'confirmed' },
      }),
    ]);

    const buyerNotices = await notificationService.listNotifications(
      storedOrders[0].buyerId,
      'mercadozetta',
      firstPage,
    );
    expect(buyerNotices.items.map(({ message }) => message)).toEqual(
      expect.arrayContaining([
        `Order ${storedOrders[0].id} created`,
        `Order ${storedOrders[0].id} is now confirmed`,
      ]),
    );
    expect(buyerNotices.page).toMatchObject({ total: 2, hasMore: false });
    const sellerNotices = await notificationService.listNotifications(
      seller._id,
      'mercadozetta',
      firstPage,
    );
    await expect(
      notificationService.countUnreadNotifications(seller._id, 'mercadozetta'),
    ).resolves.toBe(sellerNotices.items.length);
    const updatedNotice = await notificationService.updateNotificationRead(
      seller._id,
      'mercadozetta',
      sellerNotices.items[0]._id,
      true,
    );
    expect(updatedNotice).toMatchObject({
      _id: sellerNotices.items[0]._id,
      tenantId: 'mercadozetta',
      user: seller._id,
      read: true,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    await expect(
      notificationService.updateNotificationRead(
        losingCart!.buyerId,
        'mercadozetta',
        sellerNotices.items[0]._id,
        true,
      ),
    ).rejects.toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });

    await orderService.updateOrderStatus(
      storedOrders[0].buyerId,
      'mercadozetta',
      storedOrders[0].id,
      'cancelled',
    );
    await expect(
      sellerOperationsService.getSellerOperations(seller._id, 'mercadozetta', {
        lowStockThreshold: 2,
        limit: 20,
        offset: 0,
      }),
    ).resolves.toMatchObject({
      summary: {
        pricedOrderCount: 1,
        grossRevenue: { currency: 'USD', amountMinor: '0' },
      },
    });

    await expect(
      cartService.getCart(losingCart!.buyerId, 'mercadozetta'),
    ).resolves.toMatchObject({ items: [{ quantity: 1 }] });
    await cartService.removeCartItem(
      losingCart!.buyerId,
      'mercadozetta',
      product._id,
    );
    await expect(
      cartService.getCart(losingCart!.buyerId, 'mercadozetta'),
    ).resolves.toMatchObject({ items: [] });
  });

  it('preserves watchlist and verified-purchase review behavior', async () => {
    const seller = await userService.createUser(userPayload, 'mercadozetta');
    const buyer = await userService.createUser(
      { ...userPayload, email: 'review-buyer@example.com' },
      'mercadozetta',
    );
    const outsider = await userService.createUser(
      { ...userPayload, email: 'review-outsider@example.com' },
      'mercadozetta',
    );
    const product = await productRepository.create({
      tenantId: 'mercadozetta',
      seller: seller._id,
      name: 'Reviewable product',
      description: '',
      category: 'general',
      subcategory: '',
      inventory: 3,
      image: 'reviewable.png',
      status: 'active',
      price: { currency: 'USD', amountMinor: '1000' },
    });

    const firstWatch = await watchlistService.addWatchlist(
      buyer._id,
      'mercadozetta',
      product._id,
    );
    const duplicateWatch = await watchlistService.addWatchlist(
      buyer._id,
      'mercadozetta',
      product._id,
    );
    expect(duplicateWatch._id).toBe(firstWatch._id);
    expect(firstWatch.product).toMatchObject({
      _id: product._id,
      seller: seller._id,
    });
    expect(duplicateWatch.product).toMatchObject({ _id: product._id });
    await expect(
      watchlistService.listWatchlist(buyer._id, 'mercadozetta'),
    ).resolves.toMatchObject([
      {
        user: buyer._id,
        product: { _id: product._id, seller: seller._id },
      },
    ]);
    await expect(
      watchlistService.listWatchlist(buyer._id, 'campus-market'),
    ).resolves.toEqual([]);

    await expect(
      reviewService.createReview(
        seller._id,
        'mercadozetta',
        product._id,
        5,
        'Mine',
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'REVIEW_FORBIDDEN' });
    await expect(
      reviewService.createReview(
        outsider._id,
        'mercadozetta',
        product._id,
        5,
        'Not purchased',
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'REVIEW_PURCHASE_REQUIRED' });

    const now = new Date();
    const orderId = randomUUID();
    await db.insert(orders).values({
      id: orderId,
      tenantId: 'mercadozetta',
      buyerId: buyer._id,
      checkoutIdempotencyKey: randomUUID(),
      status: 'delivered',
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(orderItems).values({
      id: randomUUID(),
      tenantId: 'mercadozetta',
      orderId,
      productId: product._id,
      sellerId: seller._id,
      productName: product.name,
      quantity: 1,
      createdAt: now,
      updatedAt: now,
    });

    const reviewKey = randomUUID();
    const created = await reviewService.createReview(
      buyer._id,
      'mercadozetta',
      product._id,
      4,
      'Good',
      reviewKey,
    );
    await expect(
      reviewService.createReview(
        buyer._id,
        'mercadozetta',
        product._id,
        4,
        'Good',
        reviewKey,
      ),
    ).resolves.toMatchObject({ _id: created._id, comment: 'Good' });
    await expect(
      reviewService.createReview(
        buyer._id,
        'mercadozetta',
        product._id,
        3,
        'Different',
        reviewKey,
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    const updated = await reviewService.createReview(
      buyer._id,
      'mercadozetta',
      product._id,
      5,
      'Excellent',
      randomUUID(),
    );
    expect(updated._id).toBe(created._id);
    expect(created).toMatchObject({
      tenantId: 'mercadozetta',
      product: product._id,
      author: buyer._id,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    await expect(
      reviewService.listReviews('mercadozetta', product._id, firstPage),
    ).resolves.toMatchObject({
      items: [
        {
          _id: created._id,
          author: buyer._id,
          rating: 5,
          comment: 'Excellent',
        },
      ],
      page: { limit: 20, offset: 0, total: 1, hasMore: false },
    });
    await expect(
      reviewService.listReviews('campus-market', product._id, firstPage),
    ).resolves.toMatchObject({ items: [] });
    expect(await db.select().from(reviews)).toHaveLength(1);
    expect(
      (await db.select().from(notifications)).filter(
        ({ userId }) => userId === seller._id,
      ),
    ).toHaveLength(2);

    await watchlistService.removeWatchlist(
      buyer._id,
      'mercadozetta',
      product._id,
    );
    await expect(
      watchlistService.listWatchlist(buyer._id, 'mercadozetta'),
    ).resolves.toEqual([]);
  });
});
