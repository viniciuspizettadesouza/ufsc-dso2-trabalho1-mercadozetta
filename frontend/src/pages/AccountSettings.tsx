import { type FormEvent, type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthContext';
import { useBrand } from '@/brands/brandContext';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import {
  MutationFeedbackMessage,
  type MutationFeedback,
} from '@/components/MutationFeedback';
import Header from '@/pages/header';
import { appRoutes } from '@/routes';
import { getApiErrorMessage } from '@/services/errors';
import {
  useChangePassword,
  useDeactivateAccount,
  useRequestEmailChange,
  useUpdateProfile,
} from '@/serverState/account';

function message(error: unknown, fallback: string, delivery: string) {
  return getApiErrorMessage(error, fallback, {
    ACCOUNT_DELIVERY_UNAVAILABLE: delivery,
  });
}

function Section({
  title,
  feedback,
  children,
}: {
  title: string;
  feedback: MutationFeedback;
  children: ReactNode;
}) {
  return (
    <section className="rounded-surface border border-theme-border bg-surface p-5 shadow-surface">
      <h2 className="text-xl font-bold">{title}</h2>
      <MutationFeedbackMessage className="mt-2" feedback={feedback} />
      {children}
    </section>
  );
}

export default function AccountSettings() {
  const brand = useBrand();
  const navigate = useNavigate();
  const { user, establishSession, clearSession } = useAuth();
  const profile = useUpdateProfile();
  const password = useChangePassword();
  const emailChange = useRequestEmailChange();
  const deactivation = useDeactivateAccount();
  const [username, setUsername] = useState(user?.username || '');
  const [telephone, setTelephone] = useState(user?.telephone || '');
  const [profileFeedback, setProfileFeedback] =
    useState<MutationFeedback>(null);
  const [passwordFeedback, setPasswordFeedback] =
    useState<MutationFeedback>(null);
  const [emailFeedback, setEmailFeedback] = useState<MutationFeedback>(null);
  const [deactivationFeedback, setDeactivationFeedback] =
    useState<MutationFeedback>(null);

  function leaveForLogin(prompt: string) {
    clearSession();
    navigate(appRoutes.login, { replace: true, state: { prompt } });
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setProfileFeedback(null);
      const updated = await profile.mutateAsync({
        username,
        telephone: telephone || null,
      });
      establishSession(updated);
      setProfileFeedback({ type: 'success', message: 'Perfil atualizado.' });
    } catch (error) {
      setProfileFeedback({
        type: 'error',
        message: message(
          error,
          'Não foi possível atualizar o perfil.',
          brand.copy.account.deliveryUnavailable,
        ),
      });
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      setPasswordFeedback(null);
      await password.mutateAsync({
        currentPassword: String(data.get('currentPassword') || ''),
        password: String(data.get('password') || ''),
        passwordConfirmation: String(data.get('passwordConfirmation') || ''),
      });
      leaveForLogin('Senha alterada. Entre novamente.');
    } catch (error) {
      setPasswordFeedback({
        type: 'error',
        message: message(
          error,
          'Não foi possível alterar a senha.',
          brand.copy.account.deliveryUnavailable,
        ),
      });
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      setEmailFeedback(null);
      const result = await emailChange.mutateAsync({
        email: String(data.get('email') || ''),
        currentPassword: String(data.get('currentPassword') || ''),
      });
      setEmailFeedback({ type: 'success', message: result.message });
    } catch (error) {
      setEmailFeedback({
        type: 'error',
        message: message(
          error,
          'Não foi possível solicitar a alteração de e-mail.',
          brand.copy.account.deliveryUnavailable,
        ),
      });
    }
  }

  async function submitDeactivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const confirmation = String(data.get('confirmation') || '');
    if (confirmation !== 'DEACTIVATE') {
      setDeactivationFeedback({
        type: 'error',
        message: 'Digite DEACTIVATE para confirmar a desativação.',
      });
      return;
    }
    try {
      setDeactivationFeedback(null);
      await deactivation.mutateAsync({
        currentPassword: String(data.get('currentPassword') || ''),
        confirmation,
      });
      leaveForLogin('Conta desativada.');
    } catch (error) {
      setDeactivationFeedback({
        type: 'error',
        message: message(
          error,
          'Não foi possível desativar a conta.',
          brand.copy.account.deliveryUnavailable,
        ),
      });
    }
  }

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[760px] px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">{brand.copy.account.title}</h1>
        <div className="grid gap-5">
          <Section
            title={brand.copy.account.profileTitle}
            feedback={profileFeedback}
          >
            <form className="mt-4 grid gap-3" onSubmit={submitProfile}>
              <label htmlFor="account-username">Nome</label>
              <Input
                id="account-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <label htmlFor="account-telephone">Telefone</label>
              <Input
                id="account-telephone"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
              />
              <Button
                variant="primary"
                disabled={profile.isPending}
                aria-busy={profile.isPending}
              >
                Salvar perfil
              </Button>
            </form>
          </Section>
          <Section
            title={brand.copy.account.passwordTitle}
            feedback={passwordFeedback}
          >
            <form className="mt-4 grid gap-3" onSubmit={submitPassword}>
              <label htmlFor="password-current">Senha atual</label>
              <Input
                id="password-current"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              <label htmlFor="password-new">Nova senha</label>
              <Input
                id="password-new"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
              <label htmlFor="password-confirmation">
                Confirmar nova senha
              </label>
              <Input
                id="password-confirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                required
              />
              <Button
                variant="primary"
                disabled={password.isPending}
                aria-busy={password.isPending}
              >
                Alterar senha
              </Button>
            </form>
          </Section>
          <Section
            title={brand.copy.account.emailTitle}
            feedback={emailFeedback}
          >
            <form className="mt-4 grid gap-3" onSubmit={submitEmail}>
              <label htmlFor="email-new">Novo e-mail</label>
              <Input
                id="email-new"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
              <label htmlFor="email-password">Senha atual</label>
              <Input
                id="email-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              <Button
                variant="primary"
                disabled={emailChange.isPending}
                aria-busy={emailChange.isPending}
              >
                Enviar confirmação
              </Button>
            </form>
          </Section>
          <Section
            title={brand.copy.account.deactivationTitle}
            feedback={deactivationFeedback}
          >
            <form className="mt-4 grid gap-3" onSubmit={submitDeactivation}>
              <label htmlFor="deactivation-password">Senha atual</label>
              <Input
                id="deactivation-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              <label htmlFor="deactivation-confirmation">
                Digite DEACTIVATE
              </label>
              <Input
                id="deactivation-confirmation"
                name="confirmation"
                pattern="DEACTIVATE"
                required
              />
              <Button
                disabled={deactivation.isPending}
                aria-busy={deactivation.isPending}
              >
                Desativar conta
              </Button>
            </form>
          </Section>
        </div>
      </main>
    </div>
  );
}
