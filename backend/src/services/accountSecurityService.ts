import {
  getAccountSecurityConfig,
  getAccountTokenHashKeyRing,
  type AccountSecurityConfig,
  type SecretKeyRing,
} from '@/config/security';
import type { AccountTokenPurpose } from '@/repositories/accountTokenRepository';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import type {
  AccountMessage,
  AccountMessageSender,
} from '@/services/accountMessageSender';
import {
  createAccountToken,
  getAccountTokenSelector,
} from '@/services/accountTokenSecurityService';
import {
  dispatchAccountMessage,
  getPasswordHasher,
  invalidAccountTokenError,
  type PasswordHasher,
  verifyAccountToken,
} from '@/services/accountServiceSupport';
import { defaultTenantId } from '@/tenants';
import {
  type AccountRequestBody,
  type AccountRequestData,
  type AccountTokenConfirmationBody,
  type AccountTokenConfirmationData,
  type PasswordResetConfirmationBody,
  type PasswordResetConfirmationData,
  validateAccountRequest,
  validateAccountTokenConfirmation,
  validatePasswordResetConfirmation,
} from '@/validators/accountSecurityValidator';

export const GENERIC_ACCOUNT_REQUEST_RESPONSE = {
  message: 'If an eligible account exists, instructions will be sent.',
} as const;

type AccountSecurityDependencies = {
  config?: () => AccountSecurityConfig;
  keyRing?: () => SecretKeyRing;
  hashPassword?: PasswordHasher;
};

function tokenTtl(config: AccountSecurityConfig, purpose: AccountTokenPurpose) {
  if (purpose === 'email_verification')
    return config.emailVerificationTokenTtlMs;
  if (purpose === 'email_change') return config.emailChangeTokenTtlMs;
  return config.passwordResetTokenTtlMs;
}

export function createAccountSecurityService(
  transactions: CheckoutTransactionCoordinator,
  sender: AccountMessageSender,
  dependencies: AccountSecurityDependencies = {},
) {
  const getConfig = dependencies.config ?? getAccountSecurityConfig;
  const getKeyRing = dependencies.keyRing ?? getAccountTokenHashKeyRing;
  const hashPassword = getPasswordHasher(dependencies.hashPassword);

  async function requestToken(
    purpose: AccountTokenPurpose,
    data: AccountRequestData,
    tenantId: string,
    now: Date,
  ) {
    const config = getConfig();
    const generated = createAccountToken(tenantId, purpose, getKeyRing());
    const expiresAt = new Date(now.getTime() + tokenTtl(config, purpose));

    const message = await transactions.run(async ({ accountTokens, users }) => {
      const user = await users.findForAccountSecurityForUpdate(
        tenantId,
        data.email,
      );
      if (!user || (purpose === 'email_verification' && user.emailVerifiedAt))
        return null;

      const [latestIssuedAt, issuedInWindow] = await Promise.all([
        accountTokens.findLatestIssuedAt(tenantId, user._id, purpose),
        accountTokens.countIssuedSince(
          tenantId,
          user._id,
          purpose,
          new Date(now.getTime() - config.issueWindowMs),
        ),
      ]);
      if (
        issuedInWindow >= config.issueMax ||
        (latestIssuedAt &&
          latestIssuedAt.getTime() > now.getTime() - config.issueCooldownMs)
      )
        return null;

      await accountTokens.invalidateActive(
        tenantId,
        user._id,
        purpose,
        'replaced',
        now,
      );
      await accountTokens.create({
        _id: generated.selector,
        tenantId,
        userId: user._id,
        purpose,
        tokenHash: generated.tokenHash,
        tokenHashSecretVersion: generated.tokenHashSecretVersion,
        ...(purpose === 'email_verification'
          ? { emailVersion: user.emailVersion }
          : {}),
        expiresAt,
        createdAt: now,
      });

      return {
        kind: purpose,
        tenantId,
        userId: user._id,
        email: user.email,
        token: generated.token,
        expiresAt,
      } satisfies AccountMessage;
    });

    if (message) dispatchAccountMessage(sender, message);
    return GENERIC_ACCOUNT_REQUEST_RESPONSE;
  }

  async function requestEmailVerification(
    body: AccountRequestBody | AccountRequestData,
    tenantId = defaultTenantId,
    now = new Date(),
  ) {
    return requestToken(
      'email_verification',
      validateAccountRequest(body),
      tenantId,
      now,
    );
  }

  async function requestPasswordReset(
    body: AccountRequestBody | AccountRequestData,
    tenantId = defaultTenantId,
    now = new Date(),
  ) {
    return requestToken(
      'password_reset',
      validateAccountRequest(body),
      tenantId,
      now,
    );
  }

  async function confirmEmailVerification(
    body: AccountTokenConfirmationBody | AccountTokenConfirmationData,
    tenantId = defaultTenantId,
    now = new Date(),
  ) {
    const { token } = validateAccountTokenConfirmation(body);
    const selector = getAccountTokenSelector(token);
    if (!selector) throw invalidAccountTokenError();
    const ring = getKeyRing();

    await transactions.run(async ({ accountTokens, users, audits }) => {
      const record = verifyAccountToken(
        token,
        tenantId,
        'email_verification',
        await accountTokens.findById(tenantId, selector),
        ring,
      );
      const consumed = await accountTokens.consume({
        tenantId,
        tokenId: selector,
        purpose: 'email_verification',
        tokenHash: record.tokenHash,
        emailVersion: record.emailVersion,
        now,
      });
      if (
        !consumed ||
        record.emailVersion === undefined ||
        !(await users.markEmailVerified(
          tenantId,
          record.userId,
          record.emailVersion,
          now,
        ))
      )
        throw invalidAccountTokenError();

      await audits.append({
        tenantId,
        eventType: 'user.email_verified',
        resourceType: 'user',
        resourceId: record.userId,
        occurredAt: now,
      });
    });
  }

  async function confirmPasswordReset(
    body: PasswordResetConfirmationBody | PasswordResetConfirmationData,
    tenantId = defaultTenantId,
    now = new Date(),
  ) {
    const { token, password } = validatePasswordResetConfirmation(body);
    const selector = getAccountTokenSelector(token);
    if (!selector) throw invalidAccountTokenError();
    const [ring, passwordHash] = await Promise.all([
      Promise.resolve(getKeyRing()),
      hashPassword(password),
    ]);

    const notice = await transactions.run(
      async ({ accountTokens, users, sessions, audits }) => {
        const record = verifyAccountToken(
          token,
          tenantId,
          'password_reset',
          await accountTokens.findById(tenantId, selector),
          ring,
        );
        const user = await users.findAccountSecurityById(
          tenantId,
          record.userId,
        );
        if (!user) throw invalidAccountTokenError();

        const consumed = await accountTokens.consume({
          tenantId,
          tokenId: selector,
          purpose: 'password_reset',
          tokenHash: record.tokenHash,
          now,
        });
        if (
          !consumed ||
          !(await users.replacePasswordAndIncrementTokenVersion(
            tenantId,
            record.userId,
            passwordHash,
            now,
          ))
        )
          throw invalidAccountTokenError();

        await sessions.revokeAll(
          tenantId,
          record.userId,
          'password_reset',
          now,
        );
        await accountTokens.invalidateActive(
          tenantId,
          record.userId,
          'password_reset',
          'password_reset',
          now,
          selector,
        );
        await audits.appendMany([
          {
            tenantId,
            eventType: 'user.password_reset',
            resourceType: 'user',
            resourceId: record.userId,
            occurredAt: now,
          },
          {
            tenantId,
            eventType: 'session.revoked',
            resourceType: 'user',
            resourceId: record.userId,
            metadata: { reason: 'password_reset' },
            occurredAt: now,
          },
        ]);

        return {
          kind: 'password_reset_notice',
          tenantId,
          userId: record.userId,
          email: user.email,
          occurredAt: now,
        } satisfies AccountMessage;
      },
    );

    dispatchAccountMessage(sender, notice);
  }

  return {
    requestEmailVerification,
    requestPasswordReset,
    confirmEmailVerification,
    confirmPasswordReset,
  };
}

export type AccountSecurityService = ReturnType<
  typeof createAccountSecurityService
>;
