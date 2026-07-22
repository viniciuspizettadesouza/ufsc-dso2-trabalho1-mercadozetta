import { createContext, useContext } from 'react';
import type { components } from '@/contracts/api';

type ContractUser = components['schemas']['User'];
export type AuthUser = Pick<ContractUser, '_id'> &
  Partial<
    Pick<ContractUser, 'email' | 'emailVerifiedAt' | 'username' | 'telephone'>
  >;

export type AuthState = {
  status: 'loading' | 'authenticated' | 'anonymous';
  user: AuthUser | null;
  establishSession: (user: AuthUser) => void;
  clearSession: () => void;
};

const anonymousAuth: AuthState = {
  status: 'anonymous',
  user: null,
  establishSession: () => undefined,
  clearSession: () => undefined,
};

export const AuthContext = createContext<AuthState>(anonymousAuth);

export function useAuth() {
  return useContext(AuthContext);
}
