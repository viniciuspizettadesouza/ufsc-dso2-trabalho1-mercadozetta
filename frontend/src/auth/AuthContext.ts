import { createContext, useContext } from 'react';

export type AuthUser = {
  _id: string;
  email?: string;
  username?: string;
  telephone?: string;
};

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
