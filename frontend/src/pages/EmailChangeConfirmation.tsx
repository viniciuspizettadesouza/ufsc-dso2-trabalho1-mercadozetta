import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/auth/AuthContext';
import { useBrand } from '@/brands/brandContext';
import Header from '@/pages/header';
import { appRoutes } from '@/routes';
import { useConfirmEmailChange } from '@/serverState/account';

export default function EmailChangeConfirmation() {
  const brand = useBrand();
  const { clearSession } = useAuth();
  const confirmation = useConfirmEmailChange();
  const started = useRef(false);
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      'token',
    );
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
    setHasToken(Boolean(token));
    if (!token) return;
    confirmation.mutate(token, { onSuccess: clearSession });
  }, [clearSession, confirmation]);

  return (
    <div>
      <Header hideLoginAction />
      <main className="mx-auto max-w-[600px] px-4 py-8">
        <h1 className="text-3xl font-bold">
          {brand.copy.account.confirmationTitle}
        </h1>
        {confirmation.isPending && (
          <p role="status">Confirmando alteração...</p>
        )}
        {confirmation.isSuccess && (
          <p role="status">E-mail alterado. Entre novamente.</p>
        )}
        {(confirmation.isError || hasToken === false) && (
          <p role="alert">O link é inválido ou expirou.</p>
        )}
        <Link className="mt-4 inline-block font-bold" to={appRoutes.login}>
          Ir para o login
        </Link>
      </main>
    </div>
  );
}
