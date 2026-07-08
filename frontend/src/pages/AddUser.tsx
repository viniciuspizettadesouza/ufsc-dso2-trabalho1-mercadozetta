import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';

import Header from './header';
import api from '../services/api';

export default function Login() {
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [telephone, setTelephone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        await api.post('/add-user', {
            username, telephone, email, password

        });

        navigate('/');
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
