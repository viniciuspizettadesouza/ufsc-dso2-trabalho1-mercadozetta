import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { isAxiosError } from 'axios';

import Header from '@/pages/header';
import api from '@/services/api';
import { useBrand } from '@/brands/brandContext';
import { apiRoutes, appRoutes } from '@/routes';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

export default function AddUser() {
  const brand = useBrand();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setError('');

      await api.post(apiRoutes.users, {
        username,
        telephone,
        email,
        password,
      });

      navigate(appRoutes.home);
    } catch (err) {
      if (isAxiosError<{ error?: string }>(err) && err.response?.data.error) {
        setError(err.response.data.error);
        return;
      }

      setError(brand.copy.validation.accountCreateError);
    }
  }

  return (
    <div>
      <Header />
      <main className="flex h-full items-center justify-center">
        <form
          aria-describedby={error ? 'registration-error' : undefined}
          className="flex w-full max-w-[300px] flex-col"
          onSubmit={handleSubmit}
        >
          <h1 className="mt-5 text-center text-2xl font-bold">Criar conta</h1>
          <label className="sr-only" htmlFor="register-name">
            Name
          </label>
          <Input
            id="register-name"
            autoComplete="name"
            className="mt-5 h-12 px-5 text-base"
            type="text"
            placeholder="Name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <label className="sr-only" htmlFor="register-phone">
            Phone
          </label>
          <Input
            id="register-phone"
            autoComplete="tel"
            className="mt-5 h-12 px-5 text-base"
            type="text"
            placeholder="Phone"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
          />
          <label className="sr-only" htmlFor="register-email">
            Email
          </label>
          <Input
            id="register-email"
            autoComplete="email"
            className="mt-5 h-12 px-5 text-base"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="sr-only" htmlFor="register-password">
            Password
          </label>
          <Input
            id="register-password"
            autoComplete="new-password"
            className="mt-5 h-12 px-5 text-base"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p
              id="registration-error"
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
            {brand.copy.forms.createAccountAction}
          </Button>
        </form>
      </main>
    </div>
  );
}
