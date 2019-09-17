import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Index.css';

import api from '../services/api';

import logo from '../assets/logo.svg'

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
        <div className="login-container">


            <form onSubmit={handleSubmit}>
                <div className="login-container">
                    <Link to="/">
                        <img src={logo} alt="logo" />
                    </Link>
                </div>
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
