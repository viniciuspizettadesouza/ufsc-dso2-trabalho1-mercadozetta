import bcrypt from 'bcryptjs';
import {
  getAccountSecurityConfig,
  getAccountTokenHashKeyRing,
  type AccountSecurityConfig,
  type SecretKeyRing,
} from '@/config/security';
import AppError from '@/errors/AppError';
import type {
  AccountTokenPurpose,
  AccountTokenRecord,
} from '@/repositories/accountTokenRepository';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import type {
  AccountMessage,
  AccountMessageSender,
} from '@/services/accountMessageSender';
import {
  accountTokenMatches,
  createAccountToken,
  getAccountTokenSelector,
} from '@/services/accountTokenSecurityService';
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
  hashPassword?: (password: string) => Promise<string>;
};

function invalidAccountToken(): AppError {
  return new AppError(
    400,
    'INVALID_OR_EXPIRED_ACCOUNT_TOKEN',
    'Invalid or expired account token',
  );
}

function dispatch(sender: AccountMessageSender, message: AccountMessage) {
  void Promise.resolve()
    .then(() => sender.enqueue(message))
    .catch(() => undefined);
}

function tokenTtl(config: AccountSecurityConfig, purpose: AccountTokenPurpose) {
  if (purpose === 'email_verification')
    return config.emailVerificationTokenTtlMs;
  if (purpose === 'email_change') return config.emailChangeTokenTtlMs;
  return config.passwordResetTokenTtlMs;
}

function resolveAndVerifyToken(
  token: string,
  tenantId: string,
  purpose: AccountTokenPurpose,
  record: AccountTokenRecord | null,
  ring: SecretKeyRing,
) {
  if (
    !record ||
    record.purpose !== purpose ||
    !accountTokenMatches(
      token,
      tenantId,
      purpose,
      record.tokenHash,
      record.tokenHashSecretVersion,
      ring,
    )
  )
    throw invalidAccountToken();
  return record;
}

export function createAccountSecurityService(
  transactions: CheckoutTransactionCoordinator,
  sender: AccountMessageSender,
  dependencies: AccountSecurityDependencies = {},
) {
  const getConfig = dependencies.config ?? getAccountSecurityConfig;
  const getKeyRing = dependencies.keyRing ?? getAccountTokenHashKeyRing;
  const hashPassword =
    dependencies.hashPassword ??
    ((password: string) => bcrypt.hash(password, 10));

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

    if (message) dispatch(sender, message);
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
    if (!selector) throw invalidAccountToken();
    const ring = getKeyRing();

    await transactions.run(async ({ accountTokens, users, audits }) => {
      const record = resolveAndVerifyToken(
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
        throw invalidAccountToken();

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
    if (!selector) throw invalidAccountToken();
    const [ring, passwordHash] = await Promise.all([
      Promise.resolve(getKeyRing()),
      hashPassword(password),
    ]);

    const notice = await transactions.run(
      async ({ accountTokens, users, sessions, audits }) => {
        const record = resolveAndVerifyToken(
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
        if (!user) throw invalidAccountToken();

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
          throw invalidAccountToken();

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

    dispatch(sender, notice);
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
