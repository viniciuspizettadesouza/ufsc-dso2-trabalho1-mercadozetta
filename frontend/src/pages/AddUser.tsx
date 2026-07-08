import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { isAxiosError } from 'axios';

import Header from './header';
import api from '../services/api';

export default function AddUser() {
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

            await api.post('/add-user', {
                username, telephone, email, password
            });

            navigate('/');
        } catch (err) {
            if (isAxiosError<{ error?: string }>(err) && err.response?.data.error) {
                setError(err.response.data.error);
                return;
            }

            setError('Não foi possível criar a conta. Tente novamente.');
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
                        placeholder="Nome"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <input
                        className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
                        type="text"
                        placeholder="Telefone"
                        value={telephone}
                        onChange={e => setTelephone(e.target.value)}
                    />
                    <input
                        className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
                        type="email"
                        placeholder="E-mail"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                    <input
                        className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
                        type="password"
                        placeholder="Senha"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    {error && (
                        <p className="mt-3 text-sm font-medium text-red-600" role="alert">
                            {error}
                        </p>
                    )}
                    <button
                        className="mt-2.5 h-12 cursor-pointer rounded border-0 bg-[#3483fa] text-base font-bold text-white"
                        type="submit"
                    >
                        Criar conta
                    </button>
                </form>
            </div>
        </div>
    );
}
