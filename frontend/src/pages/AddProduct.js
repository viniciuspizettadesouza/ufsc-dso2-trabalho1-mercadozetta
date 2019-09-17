import React, { useState } from 'react';
import './Index.css';

import Header from './header';

import api from '../services/api';

export default function Login({ history }) {
    const [username, setUsername] = useState('');
    const [description, setDescription] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();

        const response = await api.post('/add-product', {
            username, description
        });

        const { _id } = response.data;

        history.push(`/user/${_id}`);
    }

    return (
        <div>
            <Header />
            <div className="login-container">
                <form onSubmit={handleSubmit}>
                    <div className="login-container">
                    </div>
                    <input
                        placeholder="Nome"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <input
                        placeholder="Descrição"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                    <button type="submit">Inserir Anúncio</button>
                </form>
            </div>
        </div>
    );
}
