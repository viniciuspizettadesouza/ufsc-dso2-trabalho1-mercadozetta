import { useNavigate } from 'react-router-dom';
import { FormEvent } from 'react';

import Header from './header/index';
import Product from './Products';

export default function Login() {
    const navigate = useNavigate();

    async function handleAccount(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        navigate('/add-user');
    }
    async function handleProdutos(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        navigate('/add-product');
    }

    return (
        <div>
            <Header />
            <div className="flex h-full items-center justify-center">
                <form className="flex w-full max-w-[300px] flex-col" onSubmit={handleAccount}>
                    <button
                        className="mt-2.5 h-12 cursor-pointer rounded border-0 bg-[#3483fa] text-base font-bold text-white"
                        type="submit"
                    >
                        Criar conta
                    </button>
                </form>

            </div>
            <div className="flex h-full items-center justify-center">
                <form className="flex w-full max-w-[300px] flex-col" onSubmit={handleProdutos}>
                    <button
                        className="mt-2.5 h-12 cursor-pointer rounded border-0 bg-[#3483fa] text-base font-bold text-white"
                        type="submit"
                    >
                        Inserir Produtos
                    </button>
                </form>
            </div>
            <Product />
        </div>
    );
}
