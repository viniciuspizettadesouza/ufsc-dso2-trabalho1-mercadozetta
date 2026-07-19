import bcrypt from 'bcryptjs';
import type { SecretKeyRing } from '@/config/security';
import AppError from '@/errors/AppError';
import type {
  AccountTokenPurpose,
  AccountTokenRecord,
} from '@/repositories/accountTokenRepository';
import type {
  AccountMessage,
  AccountMessageSender,
} from '@/services/accountMessageSender';
import { accountTokenMatches } from '@/services/accountTokenSecurityService';

export type PasswordComparer = (
  password: string,
  passwordHash: string,
) => Promise<boolean>;
export type PasswordHasher = (password: string) => Promise<string>;

export function getPasswordComparer(comparePassword?: PasswordComparer) {
  return comparePassword ?? bcrypt.compare;
}

export function getPasswordHasher(hashPassword?: PasswordHasher) {
  return hashPassword ?? ((password: string) => bcrypt.hash(password, 10));
}

export function accountStateChangedError() {
  return new AppError(
    409,
    'ACCOUNT_STATE_CHANGED',
    'Account state changed; authenticate again',
  );
}

export function invalidAccountTokenError() {
  return new AppError(
    400,
    'INVALID_OR_EXPIRED_ACCOUNT_TOKEN',
    'Invalid or expired account token',
  );
}

export function verifyAccountToken(
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
    throw invalidAccountTokenError();
  return record;
}

export function dispatchAccountMessage(
  sender: AccountMessageSender,
  message: AccountMessage,
) {
  void Promise.resolve()
    .then(() => sender.enqueue(message))
    .catch(() => undefined);
}
