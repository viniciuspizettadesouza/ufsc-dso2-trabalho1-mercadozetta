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
  findTokenVersion(tenantId: string, userId: string): Promise<number | null>;
  hasTokenVersion(
    tenantId: string,
    userId: string,
    tokenVersion: number,
  ): Promise<boolean>;
  incrementTokenVersion(tenantId: string, userId: string): Promise<boolean>;
}
