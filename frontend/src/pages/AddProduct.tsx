import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Index.css';

import Header from './header';
import api from '../services/api';

export default function Login() {
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [quant, setQuant] = useState('');
    const [image, setImage] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();

        await api.post('/add-product', {
            name, description, quant, image
        });
        navigate('/');
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
                        placeholder="Nome do Produto"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Descrição do Produto"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                    <input
                        type="number"
                        placeholder="Quantidade"
                        value={quant}
                        onChange={e => setQuant(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="URL da Imagem"
                        value={image}
                        onChange={e => setImage(e.target.value)}
                    />
                    <button type="submit">Inserir Anúncio</button>
                </form>
            </div>
        </div>
    );
}
