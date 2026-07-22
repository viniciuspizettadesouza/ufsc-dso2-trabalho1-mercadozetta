import type { components } from '@/contracts/api';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type AccountRequest = components['schemas']['AccountRequest'];
export type AccountRequestResponse =
  components['schemas']['AccountRequestResponse'];
export type PasswordResetConfirmation =
  components['schemas']['PasswordResetConfirmation'];

export async function requestPasswordReset(
  input: AccountRequest,
): Promise<AccountRequestResponse> {
  return (
    await api.post<AccountRequestResponse>(
      apiRoutes.passwordResetRequests,
      input,
    )
  ).data;
}

export async function confirmPasswordReset(
  input: PasswordResetConfirmation,
): Promise<void> {
  await api.post(apiRoutes.passwordResetConfirmations, input);
}

export async function requestEmailVerification(
  input: AccountRequest,
): Promise<AccountRequestResponse> {
  return (
    await api.post<AccountRequestResponse>(
      apiRoutes.emailVerificationRequests,
      input,
    )
  ).data;
}

export async function confirmEmailVerification(token: string): Promise<void> {
  await api.post(apiRoutes.emailVerificationConfirmations, { token });
}
