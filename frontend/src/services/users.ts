import type { components } from '@/contracts/api';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type CreateUserInput = components['schemas']['CreateUserRequest'];
export type User = components['schemas']['User'];

export async function createUser(input: CreateUserInput): Promise<User> {
  const response = await api.post<User>(apiRoutes.users, input);
  return response.data;
}
