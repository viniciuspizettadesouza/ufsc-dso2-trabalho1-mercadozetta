import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { useAccountConfirmationToken } from '@/accountConfirmationToken';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import {
  MutationFeedbackMessage,
  type MutationFeedback,
} from '@/components/MutationFeedback';
import Header from '@/pages/header';
import { appRoutes } from '@/routes';
import { useConfirmPasswordReset } from '@/serverState/accountSecurity';
import { getApiErrorMessage } from '@/services/errors';

export default function PasswordResetConfirmation() {
  const token = useAccountConfirmationToken();
  const confirmation = useConfirmPasswordReset();
  const [feedback, setFeedback] = useState<MutationFeedback>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      setFeedback(null);
      await confirmation.mutateAsync({
        token,
        password: String(data.get('password') || ''),
        passwordConfirmation: String(data.get('passwordConfirmation') || ''),
      });
      setFeedback({
        type: 'success',
        message: 'Password reset. Sign in with your new password.',
      });
      form.reset();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(
          error,
          'Unable to reset the password. Request a new link and try again.',
        ),
      });
    }
  }

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[520px] px-4 py-8">
        <h1 className="text-3xl font-bold">Choose a new password</h1>
        {!token ? (
          <p role="alert">
            The password-reset token is missing.{' '}
            <Link to={appRoutes.passwordReset}>Request a new link</Link>.
          </p>
        ) : (
          <form className="mt-5 grid gap-3" onSubmit={submit}>
            <MutationFeedbackMessage feedback={feedback} />
            <label htmlFor="reset-password">New password</label>
            <Input
              id="reset-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <label htmlFor="reset-password-confirmation">
              Confirm new password
            </label>
            <Input
              id="reset-password-confirmation"
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <Button
              aria-busy={confirmation.isPending}
              disabled={confirmation.isPending}
              variant="primary"
            >
              {confirmation.isPending
                ? 'Resetting password...'
                : 'Reset password'}
            </Button>
          </form>
        )}
        <Link className="mt-5 inline-block" to={appRoutes.login}>
          Back to login
        </Link>
      </main>
    </div>
  );
}
