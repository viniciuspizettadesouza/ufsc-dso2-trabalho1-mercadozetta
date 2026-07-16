export type SessionRecord = {
  _id: string;
  tenantId: string;
  userId: string;
  familyId: string;
  tokenVersion: number;
  refreshTokenHash: string;
  refreshTokenSecretVersion?: string;
  previousRefreshTokenHash?: string;
  previousRefreshTokenSecretVersion?: string;
  rotationCounter: number;
  rotatedAt?: Date;
  lastUsedAt: Date;
  absoluteExpiresAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  revokeReason?: string;
  userAgentLabel?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CreateSessionRecord = SessionRecord;

export type RotateSessionRecord = {
  tenantId: string;
  sessionId: string;
  expectedRefreshTokenHash: string;
  nextRefreshTokenHash: string;
  nextRefreshTokenSecretVersion: string;
  previousRefreshTokenSecretVersion: string;
  expiresAt: Date;
  now: Date;
};

export interface SessionRepository {
  create(session: CreateSessionRecord): Promise<SessionRecord>;
  findRefreshById(
    tenantId: string,
    sessionId: string,
  ): Promise<SessionRecord | null>;
  rotateCurrent(session: RotateSessionRecord): Promise<boolean>;
  revokeById(
    tenantId: string,
    sessionId: string,
    reason: string,
    now: Date,
  ): Promise<void>;
  findOwned(
    tenantId: string,
    userId: string,
    sessionId: string,
  ): Promise<SessionRecord | null>;
  listActive(
    tenantId: string,
    userId: string,
    now: Date,
  ): Promise<SessionRecord[]>;
  revokeOwned(
    tenantId: string,
    userId: string,
    sessionId: string,
    reason: string,
    now: Date,
  ): Promise<boolean>;
  revokeAll(
    tenantId: string,
    userId: string,
    reason: string,
    now: Date,
  ): Promise<void>;
  isActive(
    tenantId: string,
    userId: string,
    sessionId: string,
    tokenVersion: number,
    now: Date,
  ): Promise<boolean>;
  deleteExpired(now: Date): Promise<number>;
}
