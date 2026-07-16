import type { ReactNode } from 'react';

import { AuthContext, type AuthState, type AuthUser } from '@/auth/AuthContext';

type AuthTestProviderProps = {
  children: ReactNode;
  user?: AuthUser | null;
  status?: AuthState['status'];
  establishSession?: AuthState['establishSession'];
  clearSession?: AuthState['clearSession'];
};

export function AuthTestProvider({
  children,
  user = null,
  status = user ? 'authenticated' : 'anonymous',
  establishSession = () => undefined,
  clearSession = () => undefined,
}: AuthTestProviderProps) {
  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        establishSession,
        clearSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
