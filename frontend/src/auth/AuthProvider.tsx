import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AuthContext, type AuthUser } from '@/auth/AuthContext';
import { apiRoutes } from '@/routes';
import api, { setAuthenticationFailureHandler } from '@/services/api';

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

    api
      .get(apiRoutes.session)
      .then(({ data }) => {
        if (active) establishSession(data.user);
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
