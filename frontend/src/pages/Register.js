import React, { useState } from 'react';
import './Register.css';

import api from '../services/api';

import logo from '../assets/logo.svg'

export default function Login({ history }) {
    const [username, setUsername] = useState('');
    const [telephone, setTelephone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();

        const response = await api.post('/register', {
            username, telephone, email, password
        });

        const { _id } = response.data;

        history.push(`/user/${_id}`);
    }

    return (
        <div className="login-container">
            <form onSubmit={handleSubmit}>
                <img src={logo} alt="logo" />
                <input
                    placeholder="Nome"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                />
                <input
                    placeholder="Telefone"
                    value={telephone}
                    onChange={e => setTelephone(e.target.value)}
                />
                <input
                    placeholder="E-mail"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                />
                <input
                    placeholder="Senha"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                />
                <button type="submit">Criar conta</button>
            </form>
        </div>
    );
}
