import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AuthContext, type AuthUser } from '@/auth/AuthContext';
import { setAuthenticationFailureHandler } from '@/services/api';
import { restoreSession } from '@/services/auth';

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<
    'loading' | 'authenticated' | 'anonymous'
  >('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const clearSession = useCallback(() => {
    setUser(null);
    setStatus('anonymous');
  }, []);

  const establishSession = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    setAuthenticationFailureHandler(clearSession);
    return () => setAuthenticationFailureHandler(null);
  }, [clearSession]);

  useEffect(() => {
    let active = true;

    restoreSession()
      .then(({ user }) => {
        if (active) establishSession(user);
      })
      .catch(() => {
        if (active) clearSession();
      });

    return () => {
      active = false;
    };
  }, [clearSession, establishSession]);

  const value = useMemo(
    () => ({ status, user, establishSession, clearSession }),
    [clearSession, establishSession, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
