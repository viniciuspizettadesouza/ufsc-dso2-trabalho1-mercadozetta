import { useMutation } from '@tanstack/react-query';

import type { AuthUser } from '@/auth/AuthContext';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type LoginInput = {
  email: string;
  password: string;
};

export function useLogin() {
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const response = await api.post(apiRoutes.login, input);
      return response.data.user as AuthUser;
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      await api.post(apiRoutes.logout);
    },
  });
}
