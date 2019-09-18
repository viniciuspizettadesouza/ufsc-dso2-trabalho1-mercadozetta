import React, { useState } from 'react';
import './Index.css';

import Header from './header';

export default function Login({ history }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();

        history.push(`/user/${email}`);
        //history.push(`/`);
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
                    <button type="submit">Login</button>
                </form>
            </div>
        </div>

    );
}
