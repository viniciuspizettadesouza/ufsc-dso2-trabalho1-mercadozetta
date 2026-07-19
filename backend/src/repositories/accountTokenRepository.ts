export type AccountTokenPurpose =
  'email_verification' | 'password_reset' | 'email_change';

export type AccountTokenInvalidationReason =
  | 'replaced'
  | 'password_reset'
  | 'password_change'
  | 'email_changed'
  | 'account_deactivated';

export type AccountTokenRecord = {
  _id: string;
  tenantId: string;
  userId: string;
  purpose: AccountTokenPurpose;
  tokenHash: string;
  tokenHashSecretVersion: string;
  emailVersion?: number;
  expiresAt: Date;
  consumedAt?: Date;
  invalidatedAt?: Date;
  invalidationReason?: AccountTokenInvalidationReason;
  createdAt: Date;
};

export type CreateAccountTokenRecord = AccountTokenRecord;

export type ConsumeAccountToken = {
  tenantId: string;
  tokenId: string;
  purpose: AccountTokenPurpose;
  tokenHash: string;
  now: Date;
  emailVersion?: number;
};

export interface AccountTokenRepository {
  create(token: CreateAccountTokenRecord): Promise<AccountTokenRecord>;
  findById(
    tenantId: string,
    tokenId: string,
  ): Promise<AccountTokenRecord | null>;
  consume(input: ConsumeAccountToken): Promise<AccountTokenRecord | null>;
  invalidateActive(
    tenantId: string,
    userId: string,
    purpose: AccountTokenPurpose,
    reason: AccountTokenInvalidationReason,
    now: Date,
    exceptTokenId?: string,
  ): Promise<number>;
  countIssuedSince(
    tenantId: string,
    userId: string,
    purpose: AccountTokenPurpose,
    since: Date,
  ): Promise<number>;
  findLatestIssuedAt(
    tenantId: string,
    userId: string,
    purpose: AccountTokenPurpose,
  ): Promise<Date | null>;
  deleteRetired(before: Date): Promise<number>;
}
