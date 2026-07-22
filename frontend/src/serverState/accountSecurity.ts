import { useMutation } from '@tanstack/react-query';

import {
  confirmEmailVerification,
  confirmPasswordReset,
  requestEmailVerification,
  requestPasswordReset,
} from '@/services/accountSecurity';

export const useRequestPasswordReset = () =>
  useMutation({ mutationFn: requestPasswordReset });
export const useConfirmPasswordReset = () =>
  useMutation({ mutationFn: confirmPasswordReset });
export const useRequestEmailVerification = () =>
  useMutation({ mutationFn: requestEmailVerification });
export const useConfirmEmailVerification = () =>
  useMutation({ mutationFn: confirmEmailVerification });
