import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import AppError from '@/errors/AppError';
import type { CheckoutTransactionCoordinator } from '@/repositories/checkoutTransaction';
import { defaultTenantId } from '@/tenants';
import {
  type AccountDeactivationData,
  type AccountDeactivationRequestBody,
  validateAccountDeactivation,
} from '@/validators/accountManagementValidator';

type AccountDeactivationDependencies = {
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

function deactivationBlocked() {
  return new AppError(
    409,
    'ACCOUNT_DEACTIVATION_BLOCKED_ACTIVE_ORDERS',
    'Account cannot be deactivated while active orders remain',
  );
}

export function createAccountDeactivationService(
  transactions: CheckoutTransactionCoordinator,
  dependencies: AccountDeactivationDependencies = {},
) {
  const comparePassword = dependencies.comparePassword ?? bcrypt.compare;
  const hashPassword =
    dependencies.hashPassword ??
    ((password: string) => bcrypt.hash(password, 10));

  async function deactivateAccount(
    body: AccountDeactivationRequestBody | AccountDeactivationData,
    userId: string,
    tenantId = defaultTenantId,
    now = new Date(),
  ) {
    const data = validateAccountDeactivation(body);
    const snapshot = await transactions.run(({ users }) =>
      users.findAccountSecurityById(tenantId, userId),
    );
    if (!snapshot || snapshot.deactivatedAt) throw accountStateChanged();
    if (
      !data.currentPassword ||
      !(await comparePassword(data.currentPassword, snapshot.passwordHash))
    )
      throw new AppError(
        403,
        'REAUTHENTICATION_FAILED',
        'Current password is incorrect',
      );

    const unusablePasswordHash = await hashPassword(randomUUID());

    await transactions.run(
      async ({
        users,
        accountLifecycle,
        sessions,
        accountTokens,
        pendingEmailChanges,
        audits,
      }) => {
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
        if (await accountLifecycle.hasActiveOrders(tenantId, userId))
          throw deactivationBlocked();

        const deactivated = await users.deactivateAccount({
          tenantId,
          userId,
          expectedPasswordHash: snapshot.passwordHash,
          expectedTokenVersion: snapshot.tokenVersion,
          passwordHash: unusablePasswordHash,
          now,
        });
        if (!deactivated) throw accountStateChanged();

        await sessions.revokeAll(tenantId, userId, 'account_deactivated', now);
        for (const purpose of [
          'email_verification',
          'password_reset',
          'email_change',
        ] as const)
          await accountTokens.invalidateActive(
            tenantId,
            userId,
            purpose,
            'account_deactivated',
            now,
          );
        await pendingEmailChanges.deleteByUser(tenantId, userId);
        const archivedListingCount =
          await accountLifecycle.archiveOwnedListings(tenantId, userId, now);
        await accountLifecycle.deleteDisposableState(tenantId, userId);
        await audits.appendMany([
          {
            tenantId,
            eventType: 'user.deactivated',
            actorId: userId,
            resourceType: 'user',
            resourceId: userId,
            metadata: { archivedListingCount },
            occurredAt: now,
          },
          {
            tenantId,
            eventType: 'session.revoked',
            actorId: userId,
            resourceType: 'user',
            resourceId: userId,
            metadata: { reason: 'account_deactivated' },
            occurredAt: now,
          },
        ]);
      },
    );
  }

  return { deactivateAccount };
}

export type AccountDeactivationService = ReturnType<
  typeof createAccountDeactivationService
>;
