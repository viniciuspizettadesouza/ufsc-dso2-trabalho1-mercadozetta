import { useMutation } from '@tanstack/react-query';

import type { AuthUser } from '@/auth/AuthContext';
import { login, logout, type LoginInput } from '@/services/auth';

export type { LoginInput } from '@/services/auth';

export function useLogin() {
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const authState = await login(input);
      return authState.user satisfies AuthUser;
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: logout,
  });
}
