import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import Header from '@/pages/header';
import api from '@/services/api';
import { useBrand } from '@/brands/brandContext';
import { apiRoutes, appRoutes } from '@/routes';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

export default function Login() {
  const brand = useBrand();
  const location = useLocation();
  const navigate = useNavigate();
  const { establishSession } = useAuth();
  const routeState = location.state as
    { from?: string; prompt?: string } | undefined;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setError('');

      const response = await api.post(apiRoutes.login, {
        email,
        password,
      });

      establishSession(response.data.user);

      if (routeState?.from) {
        navigate(routeState.from, { replace: true });
      } else {
        navigate(appRoutes.sellerProducts(response.data.user._id));
      }
    } catch {
      setError(brand.copy.validation.invalidCredentials);
    }
  }

  return (
    <div>
      <Header hideLoginAction />
      <main className="flex h-full items-center justify-center">
        <form
          aria-describedby={error ? 'login-error' : undefined}
          className="flex w-full max-w-[300px] flex-col"
          onSubmit={handleSubmit}
        >
          <h1 className="mt-5 text-center text-2xl font-bold">Entrar</h1>
          {routeState?.prompt && (
            <p className="mt-5 text-center" role="status">
              {routeState.prompt}
            </p>
          )}
          <label className="sr-only" htmlFor="login-email">
            Email
          </label>
          <Input
            id="login-email"
            aria-invalid={Boolean(error)}
            autoComplete="email"
            className="mt-5 h-12 px-5 text-base"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="sr-only" htmlFor="login-password">
            Password
          </label>
          <Input
            id="login-password"
            aria-invalid={Boolean(error)}
            autoComplete="current-password"
            className="mt-5 h-12 px-5 text-base"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p
              id="login-error"
              className="mt-3 text-sm font-medium text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
          <Button
            className="mt-2.5 h-12 text-base"
            variant="primary"
            type="submit"
          >
            {brand.copy.forms.loginAction}
          </Button>
        </form>
      </main>
    </div>
  );
}
