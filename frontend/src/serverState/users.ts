import { useMutation } from '@tanstack/react-query';

import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type CreateUserInput = {
  username: string;
  telephone: string;
  email: string;
  password: string;
};

export function useCreateUser() {
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      await api.post(apiRoutes.users, input);
    },
  });
}
