import { useMutation } from '@tanstack/react-query';
import {
  changePassword,
  confirmEmailChange,
  deactivateAccount,
  requestEmailChange,
  updateProfile,
} from '@/services/account';

export const useUpdateProfile = () =>
  useMutation({ mutationFn: updateProfile });
export const useChangePassword = () =>
  useMutation({ mutationFn: changePassword });
export const useRequestEmailChange = () =>
  useMutation({ mutationFn: requestEmailChange });
export const useConfirmEmailChange = () =>
  useMutation({ mutationFn: confirmEmailChange });
export const useDeactivateAccount = () =>
  useMutation({ mutationFn: deactivateAccount });
