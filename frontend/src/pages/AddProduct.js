import React, { useState } from 'react';
import './Index.css';

import Header from './header';
import api from '../services/api';

export default function Login({ history }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [quant, setQuant] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();

        const response = await api.post('/add-product', {
            name, description, quant
        });
        console.log(response.data);
        history.push(`/user/:id`);
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
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Descrição"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Quantidade"
                        value={quant}
                        onChange={e => setQuant(e.target.value)}
                    />
                    <button type="submit">Inserir Anúncio</button>
                </form>
            </div>
        </div>
    );
}
