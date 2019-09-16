import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Index.css';

import api from '../services/api';

import logo from '../assets/logo.svg'

export default function Login({ history }) {
    const [username, setUsername] = useState('');
    const [description, setDescription] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();

        const response = await api.post('/register', {
            username, description
        });

        const { _id } = response.data;

        history.push(`/user/${_id}`);
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
                    placeholder="Descrição"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                />
                <button type="submit">Inserir Anúncio</button>
            </form>
        </div>
    );
}
