import { AccountRequestForm } from '@/components/AccountRequestForm';
import { useRequestPasswordReset } from '@/serverState/accountSecurity';

export default function PasswordResetRequest() {
  const request = useRequestPasswordReset();
  return (
    <AccountRequestForm
      title="Reset password"
      description="Request a single-use password-reset link. The response does not disclose whether an account exists."
      pending={request.isPending}
      submitLabel="Send password-reset link"
      onSubmit={(email) => request.mutateAsync({ email })}
    />
  );
}
