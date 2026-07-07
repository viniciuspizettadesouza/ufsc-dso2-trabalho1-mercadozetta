import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Header from './header';
import api from '../services/api';

export default function Login() {
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [quant, setQuant] = useState('');
    const [image, setImage] = useState('');

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        await api.post('/products', {
            name, description, quant, image
        });
        navigate('/');
    }

    return (
        <div>
            <Header />
            <div className="flex h-full items-center justify-center">
                <form className="flex w-full max-w-[300px] flex-col" onSubmit={handleSubmit}>
                    <input
                        className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
                        type="text"
                        placeholder="Nome do Produto"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                    <input
                        className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
                        type="text"
                        placeholder="Descrição do Produto"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                    <input
                        className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
                        type="number"
                        placeholder="Quantidade"
                        value={quant}
                        onChange={e => setQuant(e.target.value)}
                    />
                    <input
                        className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
                        type="text"
                        placeholder="URL da Imagem"
                        value={image}
                        onChange={e => setImage(e.target.value)}
                    />
                    <button
                        className="mt-2.5 h-12 cursor-pointer rounded border-0 bg-[#3483fa] text-base font-bold text-white"
                        type="submit"
                    >
                        Inserir Anúncio
                    </button>
                </form>
            </div>
        </div>
    );
}
