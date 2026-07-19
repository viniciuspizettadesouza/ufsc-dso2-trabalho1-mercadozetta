import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  getAccountSecurityConfig,
  getAccountTokenHashKeyRing,
  type AccountSecurityConfig,
  type SecretKeyRing,
} from '@/config/security';
import AppError from '@/errors/AppError';
import type { AccountTokenRecord } from '@/repositories/accountTokenRepository';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import { DuplicatePendingEmailError } from '@/repositories/pendingEmailChangeRepository';
import { DuplicateUserEmailError } from '@/repositories/userRepository';
import type { AccountMessageSender } from '@/services/accountMessageSender';
import {
  accountTokenMatches,
  createAccountToken,
  getAccountTokenSelector,
} from '@/services/accountTokenSecurityService';
import { defaultTenantId } from '@/tenants';
import {
  type AccountTokenConfirmationBody,
  type AccountTokenConfirmationData,
  validateAccountTokenConfirmation,
} from '@/validators/accountSecurityValidator';
import {
  type EmailChangeRequestBody,
  type EmailChangeRequestData,
  validateEmailChangeRequest,
} from '@/validators/accountManagementValidator';

export const EMAIL_CHANGE_REQUEST_RESPONSE = {
  message:
    'If the address can be used, confirmation instructions will be sent.',
} as const;

type EmailChangeDependencies = {
  comparePassword?: (
    password: string,
    passwordHash: string,
  ) => Promise<boolean>;
  config?: () => AccountSecurityConfig;
  keyRing?: () => SecretKeyRing;
};

function accountStateChanged() {
  return new AppError(
    409,
    'ACCOUNT_STATE_CHANGED',
    'Account state changed; authenticate again',
  );
}

function emailUnavailable() {
  return new AppError(409, 'EMAIL_UNAVAILABLE', 'Email is unavailable');
}

function invalidAccountToken() {
  return new AppError(
    400,
    'INVALID_OR_EXPIRED_ACCOUNT_TOKEN',
    'Invalid or expired account token',
  );
}

function mapEmailConflict(error: unknown): never {
  if (
    error instanceof DuplicatePendingEmailError ||
    error instanceof DuplicateUserEmailError
  )
    throw emailUnavailable();
  throw error;
}

function resolveEmailChangeToken(
  token: string,
  tenantId: string,
  record: AccountTokenRecord | null,
  ring: SecretKeyRing,
) {
  if (
    !record ||
    record.purpose !== 'email_change' ||
    !accountTokenMatches(
      token,
      tenantId,
      'email_change',
      record.tokenHash,
      record.tokenHashSecretVersion,
      ring,
    )
  )
    throw invalidAccountToken();
  return record;
}

function dispatch(
  sender: AccountMessageSender,
  message: Parameters<AccountMessageSender['enqueue']>[0],
) {
  void Promise.resolve()
    .then(() => sender.enqueue(message))
    .catch(() => undefined);
}

export function createEmailChangeService(
  transactions: CheckoutTransactionCoordinator,
  sender: AccountMessageSender,
  dependencies: EmailChangeDependencies = {},
) {
  const comparePassword = dependencies.comparePassword ?? bcrypt.compare;
  const getConfig = dependencies.config ?? getAccountSecurityConfig;
  const getKeyRing = dependencies.keyRing ?? getAccountTokenHashKeyRing;

  async function requestEmailChange(
    body: EmailChangeRequestBody | EmailChangeRequestData,
    userId: string,
    tenantId = defaultTenantId,
    now = new Date(),
  ) {
    const data = validateEmailChangeRequest(body);
    const snapshot = await transactions.run(({ users }) =>
      users.findAccountSecurityById(tenantId, userId),
    );
    if (!snapshot || snapshot.deactivatedAt) throw accountStateChanged();
    if (snapshot.email.toLowerCase() === data.email)
      throw new AppError(
        400,
        'EMAIL_UNCHANGED',
        'New email must differ from the current email',
      );
    if (!(await comparePassword(data.currentPassword, snapshot.passwordHash)))
      throw new AppError(
        403,
        'REAUTHENTICATION_FAILED',
        'Current password is incorrect',
      );

    const generated = createAccountToken(
      tenantId,
      'email_change',
      getKeyRing(),
    );
    const expiresAt = new Date(
      now.getTime() + getConfig().emailChangeTokenTtlMs,
    );

    let message;
    try {
      message = await transactions.run(
        async ({ users, accountTokens, pendingEmailChanges, audits }) => {
          const locked = await users.findAccountSecurityByIdForUpdate(
            tenantId,
            userId,
          );
          if (
            !locked ||
            locked.deactivatedAt ||
            locked.passwordHash !== snapshot.passwordHash ||
            locked.tokenVersion !== snapshot.tokenVersion
          )
            throw accountStateChanged();
          if (locked.email.toLowerCase() === data.email)
            throw new AppError(
              400,
              'EMAIL_UNCHANGED',
              'New email must differ from the current email',
            );
          if (await users.emailExists(tenantId, data.email))
            throw emailUnavailable();

          await accountTokens.invalidateActive(
            tenantId,
            userId,
            'email_change',
            'replaced',
            now,
          );
          await pendingEmailChanges.save({
            _id: randomUUID(),
            tenantId,
            userId,
            email: data.email,
            emailVersion: locked.emailVersion,
            expiresAt,
            createdAt: now,
          });
          await accountTokens.create({
            _id: generated.selector,
            tenantId,
            userId,
            purpose: 'email_change',
            tokenHash: generated.tokenHash,
            tokenHashSecretVersion: generated.tokenHashSecretVersion,
            emailVersion: locked.emailVersion,
            expiresAt,
            createdAt: now,
          });
          await audits.append({
            tenantId,
            eventType: 'user.email_change_requested',
            actorId: userId,
            resourceType: 'user',
            resourceId: userId,
            occurredAt: now,
          });

          return {
            kind: 'email_change' as const,
            tenantId,
            userId,
            email: data.email,
            token: generated.token,
            expiresAt,
          };
        },
      );
    } catch (error) {
      mapEmailConflict(error);
    }

    dispatch(sender, message);
    return EMAIL_CHANGE_REQUEST_RESPONSE;
  }

  async function confirmEmailChange(
    body: AccountTokenConfirmationBody | AccountTokenConfirmationData,
    tenantId = defaultTenantId,
    now = new Date(),
  ) {
    const { token } = validateAccountTokenConfirmation(body);
    const selector = getAccountTokenSelector(token);
    if (!selector) throw invalidAccountToken();
    const ring = getKeyRing();

    try {
      await transactions.run(
        async ({
          users,
          accountTokens,
          pendingEmailChanges,
          sessions,
          audits,
        }) => {
          const record = resolveEmailChangeToken(
            token,
            tenantId,
            await accountTokens.findById(tenantId, selector),
            ring,
          );
          const user = await users.findAccountSecurityByIdForUpdate(
            tenantId,
            record.userId,
          );
          const pending = await pendingEmailChanges.findByUserForUpdate(
            tenantId,
            record.userId,
          );
          if (
            !pending ||
            !user ||
            user.deactivatedAt ||
            record.emailVersion === undefined ||
            pending.emailVersion !== record.emailVersion ||
            user.emailVersion !== record.emailVersion ||
            pending.expiresAt.getTime() <= now.getTime()
          )
            throw invalidAccountToken();

          const consumed = await accountTokens.consume({
            tenantId,
            tokenId: selector,
            purpose: 'email_change',
            tokenHash: record.tokenHash,
            emailVersion: record.emailVersion,
            now,
          });
          if (
            !consumed ||
            !(await users.promoteAccountEmail({
              tenantId,
              userId: record.userId,
              expectedEmailVersion: record.emailVersion,
              email: pending.email,
              now,
            })) ||
            !(await pendingEmailChanges.deleteByUser(tenantId, record.userId))
          )
            throw invalidAccountToken();

          await sessions.revokeAll(
            tenantId,
            record.userId,
            'email_changed',
            now,
          );
          await accountTokens.invalidateActive(
            tenantId,
            record.userId,
            'email_verification',
            'email_changed',
            now,
          );
          await accountTokens.invalidateActive(
            tenantId,
            record.userId,
            'password_reset',
            'email_changed',
            now,
          );
          await accountTokens.invalidateActive(
            tenantId,
            record.userId,
            'email_change',
            'email_changed',
            now,
            selector,
          );
          await audits.appendMany([
            {
              tenantId,
              eventType: 'user.email_changed',
              resourceType: 'user',
              resourceId: record.userId,
              occurredAt: now,
            },
            {
              tenantId,
              eventType: 'session.revoked',
              resourceType: 'user',
              resourceId: record.userId,
              metadata: { reason: 'email_changed' },
              occurredAt: now,
            },
          ]);
        },
      );
    } catch (error) {
      mapEmailConflict(error);
    }
  }

  return { requestEmailChange, confirmEmailChange };
}

export type EmailChangeService = ReturnType<typeof createEmailChangeService>;
