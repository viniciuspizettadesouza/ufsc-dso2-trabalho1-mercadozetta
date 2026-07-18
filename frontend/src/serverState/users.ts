import { useMutation } from '@tanstack/react-query';

import { createUser, type CreateUserInput } from '@/services/users';

export type { CreateUserInput } from '@/services/users';

export function useCreateUser() {
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
  });
}
