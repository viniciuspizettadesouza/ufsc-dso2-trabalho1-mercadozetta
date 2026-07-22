import { useState } from 'react';
import { Link } from 'react-router';

import { useAccountConfirmationToken } from '@/accountConfirmationToken';
import { Button } from '@/components/Button';
import {
  MutationFeedbackMessage,
  type MutationFeedback,
} from '@/components/MutationFeedback';
import Header from '@/pages/header';
import { appRoutes } from '@/routes';
import { useConfirmEmailVerification } from '@/serverState/accountSecurity';
import { getApiErrorMessage } from '@/services/errors';

export default function EmailVerificationConfirmation() {
  const token = useAccountConfirmationToken();
  const confirmation = useConfirmEmailVerification();
  const [feedback, setFeedback] = useState<MutationFeedback>(null);

  async function confirm() {
    try {
      setFeedback(null);
      await confirmation.mutateAsync(token);
      setFeedback({ type: 'success', message: 'Email address verified.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(
          error,
          'Unable to verify the email address. Request a new link and try again.',
        ),
      });
    }
  }

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[520px] px-4 py-8">
        <h1 className="text-3xl font-bold">Confirm email address</h1>
        <MutationFeedbackMessage className="mt-4" feedback={feedback} />
        {!token ? (
          <p role="alert">The email-verification token is missing.</p>
        ) : (
          <Button
            className="mt-5"
            aria-busy={confirmation.isPending}
            disabled={confirmation.isPending || feedback?.type === 'success'}
            onClick={confirm}
            variant="primary"
          >
            {confirmation.isPending ? 'Verifying email...' : 'Verify email'}
          </Button>
        )}
        <div className="mt-5 flex gap-4">
          <Link to={appRoutes.emailVerification}>Request a new link</Link>
          <Link to={appRoutes.login}>Back to login</Link>
        </div>
      </main>
    </div>
  );
}
