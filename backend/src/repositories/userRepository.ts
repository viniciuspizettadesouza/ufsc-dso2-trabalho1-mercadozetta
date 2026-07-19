export type PublicUser = {
  _id: string;
  tenantId: string;
  email: string;
  username?: string | null;
  telephone?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CreateUserRecord = {
  tenantId: string;
  email: string;
  password: string;
  username: string;
  telephone: string;
};

export type AuthenticationUser = PublicUser & {
  passwordHash: string;
  tokenVersion: number;
  deactivatedAt: Date | null;
};

export type AccountSecurityUser = {
  _id: string;
  tenantId: string;
  email: string;
  emailVerifiedAt: Date | null;
  emailVersion: number;
  passwordHash: string;
  tokenVersion: number;
  deactivatedAt: Date | null;
};

export type UpdateUserProfile = {
  username?: string;
  telephone?: string | null;
};

export type ReplaceAccountPassword = {
  tenantId: string;
  userId: string;
  expectedPasswordHash: string;
  expectedTokenVersion: number;
  passwordHash: string;
  now: Date;
};

export type PromoteAccountEmail = {
  tenantId: string;
  userId: string;
  expectedEmailVersion: number;
  email: string;
  now: Date;
};

export type DeactivateAccount = {
  tenantId: string;
  userId: string;
  expectedPasswordHash: string;
  expectedTokenVersion: number;
  passwordHash: string;
  now: Date;
};

export class DuplicateUserEmailError extends Error {
  constructor() {
    super('User email already exists for tenant');
    this.name = 'DuplicateUserEmailError';
  }
}

export interface UserRepository {
  emailExists(tenantId: string, email: string): Promise<boolean>;
  create(user: CreateUserRecord): Promise<PublicUser>;
  findPublicById(tenantId: string, userId: string): Promise<PublicUser | null>;
  findForAuthentication(
    tenantId: string,
    email: string,
  ): Promise<AuthenticationUser | null>;
  findForAccountSecurity(
    tenantId: string,
    email: string,
  ): Promise<AccountSecurityUser | null>;
  findForAccountSecurityForUpdate(
    tenantId: string,
    email: string,
  ): Promise<AccountSecurityUser | null>;
  findAccountSecurityById(
    tenantId: string,
    userId: string,
  ): Promise<AccountSecurityUser | null>;
  findAccountSecurityByIdForUpdate(
    tenantId: string,
    userId: string,
  ): Promise<AccountSecurityUser | null>;
  updateProfile(
    tenantId: string,
    userId: string,
    fields: UpdateUserProfile,
    now: Date,
  ): Promise<PublicUser | null>;
  replaceAccountPassword(input: ReplaceAccountPassword): Promise<boolean>;
  promoteAccountEmail(input: PromoteAccountEmail): Promise<boolean>;
  deactivateAccount(input: DeactivateAccount): Promise<boolean>;
  markEmailVerified(
    tenantId: string,
    userId: string,
    emailVersion: number,
    now: Date,
  ): Promise<boolean>;
  replacePasswordAndIncrementTokenVersion(
    tenantId: string,
    userId: string,
    passwordHash: string,
    now: Date,
  ): Promise<boolean>;
  findTokenVersion(tenantId: string, userId: string): Promise<number | null>;
  hasTokenVersion(
    tenantId: string,
    userId: string,
    tokenVersion: number,
  ): Promise<boolean>;
  incrementTokenVersion(tenantId: string, userId: string): Promise<boolean>;
}
