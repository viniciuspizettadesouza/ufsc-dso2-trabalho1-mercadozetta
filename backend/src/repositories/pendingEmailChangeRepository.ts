export type PendingEmailChangeRecord = {
  _id: string;
  tenantId: string;
  userId: string;
  email: string;
  emailVersion: number;
  expiresAt: Date;
  createdAt: Date;
};

export type SavePendingEmailChange = PendingEmailChangeRecord;

export class DuplicatePendingEmailError extends Error {
  constructor() {
    super('Pending email is already in use for tenant');
    this.name = 'DuplicatePendingEmailError';
  }
}

export interface PendingEmailChangeRepository {
  save(change: SavePendingEmailChange): Promise<PendingEmailChangeRecord>;
  findByUser(
    tenantId: string,
    userId: string,
  ): Promise<PendingEmailChangeRecord | null>;
  findByUserForUpdate(
    tenantId: string,
    userId: string,
  ): Promise<PendingEmailChangeRecord | null>;
  deleteByUser(tenantId: string, userId: string): Promise<boolean>;
  deleteExpired(before: Date): Promise<number>;
}
