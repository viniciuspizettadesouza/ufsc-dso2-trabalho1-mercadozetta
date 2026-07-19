import type { AccountTokenPurpose } from '@/repositories/accountTokenRepository';

export type AccountTokenMessage = {
  kind: AccountTokenPurpose;
  tenantId: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: Date;
};

export type PasswordResetNotice = {
  kind: 'password_reset_notice';
  tenantId: string;
  userId: string;
  email: string;
  occurredAt: Date;
};

export type AccountMessage = AccountTokenMessage | PasswordResetNotice;

export interface AccountMessageSender {
  enqueue(message: AccountMessage): Promise<void>;
}
