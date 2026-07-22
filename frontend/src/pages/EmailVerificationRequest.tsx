import { useAuth } from '@/auth/AuthContext';
import { AccountRequestForm } from '@/components/AccountRequestForm';
import { useRequestEmailVerification } from '@/serverState/accountSecurity';

export default function EmailVerificationRequest() {
  const { user } = useAuth();
  const request = useRequestEmailVerification();
  return (
    <AccountRequestForm
      title="Verify email"
      description="Request a single-use link that proves control of your current email address."
      initialEmail={user?.email}
      pending={request.isPending}
      submitLabel="Send verification link"
      onSubmit={(email) => request.mutateAsync({ email })}
    />
  );
}
