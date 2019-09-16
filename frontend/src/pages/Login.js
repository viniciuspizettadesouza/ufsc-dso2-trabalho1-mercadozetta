import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Index.css';


import logo from '../assets/logo.svg'

export default function Login({ history }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();

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
                    placeholder="E-mail"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                />
                <input
                    placeholder="Senha"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                />
                <button type="submit">Login</button>
            </form>
        </div>
    );
}
