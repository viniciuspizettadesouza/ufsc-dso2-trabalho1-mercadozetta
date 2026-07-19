import bcrypt from 'bcryptjs';
import AppError from '@/errors/AppError';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import { defaultTenantId } from '@/tenants';
import {
  type PasswordChangeData,
  type PasswordChangeRequestBody,
  type ProfileUpdateData,
  type ProfileUpdateRequestBody,
  validatePasswordChange,
  validateProfileUpdate,
} from '@/validators/accountManagementValidator';

type AccountManagementDependencies = {
  comparePassword?: (
    password: string,
    passwordHash: string,
  ) => Promise<boolean>;
  hashPassword?: (password: string) => Promise<string>;
};

function accountStateChanged() {
  return new AppError(
    409,
    'ACCOUNT_STATE_CHANGED',
    'Account state changed; authenticate again',
  );
}

export function createAccountManagementService(
  transactions: CheckoutTransactionCoordinator,
  dependencies: AccountManagementDependencies = {},
) {
  const comparePassword = dependencies.comparePassword ?? bcrypt.compare;
  const hashPassword =
    dependencies.hashPassword ??
    ((password: string) => bcrypt.hash(password, 10));

  async function updateProfile(
    body: ProfileUpdateRequestBody | ProfileUpdateData,
    userId: string,
    tenantId = defaultTenantId,
    now = new Date(),
  ) {
    const data = validateProfileUpdate(body);
    return transactions.run(async ({ users, audits }) => {
      const updated = await users.updateProfile(tenantId, userId, data, now);
      if (!updated) throw accountStateChanged();

      await audits.append({
        tenantId,
        eventType: 'user.profile_updated',
        actorId: userId,
        resourceType: 'user',
        resourceId: userId,
        metadata: { changedFields: Object.keys(data).join(',') },
        occurredAt: now,
      });
      return updated;
    });
  }

  async function changePassword(
    body: PasswordChangeRequestBody | PasswordChangeData,
    userId: string,
    tenantId = defaultTenantId,
    now = new Date(),
  ) {
    const data = validatePasswordChange(body);
    const snapshot = await transactions.run(({ users }) =>
      users.findAccountSecurityById(tenantId, userId),
    );
    if (!snapshot || snapshot.deactivatedAt) throw accountStateChanged();

    if (!(await comparePassword(data.currentPassword, snapshot.passwordHash))) {
      throw new AppError(
        403,
        'REAUTHENTICATION_FAILED',
        'Current password is incorrect',
      );
    }
    if (await comparePassword(data.password, snapshot.passwordHash)) {
      throw new AppError(
        400,
        'PASSWORD_REUSE_NOT_ALLOWED',
        'New password must differ from the current password',
      );
    }
    const passwordHash = await hashPassword(data.password);

    await transactions.run(
      async ({ users, sessions, accountTokens, audits }) => {
        const replaced = await users.replaceAccountPassword({
          tenantId,
          userId,
          expectedPasswordHash: snapshot.passwordHash,
          expectedTokenVersion: snapshot.tokenVersion,
          passwordHash,
          now,
        });
        if (!replaced) throw accountStateChanged();

        await sessions.revokeAll(tenantId, userId, 'password_change', now);
        await accountTokens.invalidateActive(
          tenantId,
          userId,
          'password_reset',
          'password_change',
          now,
        );
        await audits.appendMany([
          {
            tenantId,
            eventType: 'user.password_changed',
            actorId: userId,
            resourceType: 'user',
            resourceId: userId,
            occurredAt: now,
          },
          {
            tenantId,
            eventType: 'session.revoked',
            actorId: userId,
            resourceType: 'user',
            resourceId: userId,
            metadata: { reason: 'password_change' },
            occurredAt: now,
          },
        ]);
      },
    );
  }

  return { updateProfile, changePassword };
}

export type AccountManagementService = ReturnType<
  typeof createAccountManagementService
>;
