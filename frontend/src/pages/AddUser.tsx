import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { isAxiosError } from 'axios';

import Header from './header';
import api from '../services/api';
import { useBrand } from '../brands/brandContext';
import { apiRoutes, appRoutes } from '../routes';

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
                username, telephone, email, password
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
            <div className="flex h-full items-center justify-center">
                <form className="flex w-full max-w-[300px] flex-col" onSubmit={handleSubmit}>
                    <input
                        className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
                        type="text"
                        placeholder="Name"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <input
                        className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
                        type="text"
                        placeholder="Phone"
                        value={telephone}
                        onChange={e => setTelephone(e.target.value)}
                    />
                    <input
                        className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                    <input
                        className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    {error && (
                        <p className="mt-3 text-sm font-medium text-red-600" role="alert">
                            {error}
                        </p>
                    )}
                    <button
                        className="mt-2.5 h-12 cursor-pointer rounded border-0 bg-[var(--brand-secondary)] text-base font-bold text-white"
                        type="submit"
                    >
                        {brand.copy.forms.createAccountAction}
                    </button>
                </form>
            </div>
        </div>
    );
}
