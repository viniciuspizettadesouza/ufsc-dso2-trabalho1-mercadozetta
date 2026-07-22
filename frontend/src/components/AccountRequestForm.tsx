import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import {
  MutationFeedbackMessage,
  type MutationFeedback,
} from '@/components/MutationFeedback';
import Header from '@/pages/header';
import { appRoutes } from '@/routes';
import { getApiErrorMessage } from '@/services/errors';

export function AccountRequestForm({
  title,
  description,
  initialEmail = '',
  pending,
  submitLabel,
  onSubmit,
}: {
  title: string;
  description: string;
  initialEmail?: string;
  pending: boolean;
  submitLabel: string;
  onSubmit: (email: string) => Promise<{ message: string }>;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [feedback, setFeedback] = useState<MutationFeedback>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setFeedback(null);
      const response = await onSubmit(email);
      setFeedback({ type: 'success', message: response.message });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Unable to submit the request.', {
          ACCOUNT_DELIVERY_UNAVAILABLE:
            'Account-message delivery is unavailable in this environment.',
        }),
      });
    }
  }

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[520px] px-4 py-8">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2">{description}</p>
        <p className="mt-2 text-sm">
          Local development writes the single-use confirmation link to the API
          log as a <code>development_account_message</code>. Production delivery
          remains disabled until Step 20.
        </p>
        <MutationFeedbackMessage className="mt-4" feedback={feedback} />
        <form className="mt-5 grid gap-3" onSubmit={submit}>
          <label htmlFor="account-request-email">Email</label>
          <Input
            id="account-request-email"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Button
            aria-busy={pending}
            disabled={pending}
            type="submit"
            variant="primary"
          >
            {pending ? 'Sending request...' : submitLabel}
          </Button>
        </form>
        <Link className="mt-5 inline-block" to={appRoutes.login}>
          Back to login
        </Link>
      </main>
    </div>
  );
}
