import type { components } from '@/contracts/api';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type LoginInput = components['schemas']['LoginRequest'];
export type AuthState = components['schemas']['AuthStateResponse'];

export async function login(input: LoginInput): Promise<AuthState> {
  const response = await api.post<AuthState>(apiRoutes.login, input);
  return response.data;
}

export async function restoreSession(): Promise<AuthState> {
  const response = await api.get<AuthState>(apiRoutes.session);
  return response.data;
}

export async function logout(): Promise<void> {
  await api.post<void>(apiRoutes.logout);
}
