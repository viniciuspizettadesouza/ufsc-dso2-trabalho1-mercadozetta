import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Index.css';

import Header from './header';
import api from '../services/api';

export default function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        try {
            setError('');

            const response = await api.post('/login', {
                email,
                password,
            });

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            navigate(`/user/${response.data.user._id}`);
        } catch {
            setError('E-mail ou senha inválidos');
        }
    }

    return (
        <div>
            <Header />
            <div className="login-container">
                <form onSubmit={handleSubmit}>
                    <input
                        type="email"
                        placeholder="E-mail"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Senha"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    {error && <p>{error}</p>}
                    <button type="submit">Login</button>
                </form>
            </div>
        </div>

    );
}
