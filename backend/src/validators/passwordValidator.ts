import { isStrongPassword } from '@/validators/userValidator';

export type PasswordConfirmationFields = {
  password: string;
  passwordConfirmation: string;
};

export function passwordsMatchWhenPresent({
  password,
  passwordConfirmation,
}: PasswordConfirmationFields) {
  return (
    !password || !passwordConfirmation || password === passwordConfirmation
  );
}

export function passwordIsStrongWhenPresent({
  password,
}: Pick<PasswordConfirmationFields, 'password'>) {
  return !password || isStrongPassword(password);
}

export const passwordConfirmationMismatchIssue = {
  message: 'Password confirmation does not match',
  params: { appCode: 'PASSWORD_CONFIRMATION_MISMATCH', statusCode: 400 },
} as const;

export const weakPasswordIssue = {
  message: 'Password must be at least 8 characters long',
  params: { appCode: 'WEAK_PASSWORD', statusCode: 400 },
} as const;
