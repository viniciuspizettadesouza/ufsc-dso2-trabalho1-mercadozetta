import type { components } from '@/contracts/api';
import { apiRoutes } from '@/routes';
import api from '@/services/api';

export type ProfileUpdate = components['schemas']['ProfileUpdateRequest'];
export type PasswordChange = components['schemas']['PasswordChangeRequest'];
export type EmailChangeRequest = components['schemas']['EmailChangeRequest'];
export type AccountDeactivation =
  components['schemas']['AccountDeactivationRequest'];
export type User = components['schemas']['User'];
export type EmailChangeResponse =
  components['schemas']['EmailChangeRequestResponse'];

export async function updateProfile(input: ProfileUpdate): Promise<User> {
  return (await api.patch<User>(apiRoutes.accountProfile, input)).data;
}

export async function changePassword(input: PasswordChange): Promise<void> {
  await api.post(apiRoutes.passwordChanges, input);
}

export async function requestEmailChange(
  input: EmailChangeRequest,
): Promise<EmailChangeResponse> {
  return (await api.post<EmailChangeResponse>(apiRoutes.emailChanges, input))
    .data;
}

export async function confirmEmailChange(token: string): Promise<void> {
  await api.post(apiRoutes.emailChangeConfirmations, { token });
}

export async function deactivateAccount(
  input: AccountDeactivation,
): Promise<void> {
  await api.post(apiRoutes.accountDeactivation, input);
}
