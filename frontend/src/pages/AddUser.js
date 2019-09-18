import React, { useState } from 'react';
import './Index.css';

import Header from './header';
import api from '../services/api';

export default function Login({ history }) {
    const [username, setUsername] = useState('');
    const [telephone, setTelephone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();

        const response = await api.post('/add-user', {
            username, telephone, email, password

        });
        console.log(response.data);

        history.push(`/user/${email}`);
    }

    return (
        <div>
            <Header />
            <div className="login-container">
                <form onSubmit={handleSubmit}>
                    <div className="login-container">
                    </div>
                    <input
                        type="text"
                        placeholder="Nome"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Telefone"
                        value={telephone}
                        onChange={e => setTelephone(e.target.value)}
                    />
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
                    <button type="submit">Criar conta</button>
                </form>
            </div>
        </div>
    );
}
