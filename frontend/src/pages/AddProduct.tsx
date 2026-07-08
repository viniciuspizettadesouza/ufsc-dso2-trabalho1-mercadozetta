import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { isAxiosError } from 'axios';

import Header from './header';
import api from '../services/api';
import { apiRoutes, appRoutes } from '../routes';

type StoredUser = {
    _id?: string;
};

function getStoredUser(): StoredUser | null {
    const storedUser = localStorage.getItem('user');

    if (!storedUser) {
        return null;
    }

    try {
        return JSON.parse(storedUser);
    } catch {
        localStorage.removeItem('user');
        return null;
    }
}

export default function AddProduct() {
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [quant, setQuant] = useState('');
    const [image, setImage] = useState('');
    const [error, setError] = useState('');

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        const user = getStoredUser();

        if (!localStorage.getItem('token') || !user?._id) {
            setError('Faça login para inserir um anúncio.');
            return;
        }

        try {
            setError('');

            await api.post(apiRoutes.products, {
                name, description, quant, image
            });

            navigate(appRoutes.sellerProducts(user._id));
        } catch (err) {
            if (isAxiosError<{ error?: string }>(err) && err.response?.data.error) {
                setError(err.response.data.error);
                return;
            }

            setError('Não foi possível inserir o anúncio. Tente novamente.');
        }
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
                    {error && (
                        <p className="mt-3 text-sm font-medium text-red-600" role="alert">
                            {error}
                        </p>
                    )}
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
