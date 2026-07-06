import { useNavigate } from 'react-router-dom';
import { FormEvent } from 'react';
import './Index.css';

import Header from './header/index';
import Product from './Products';

export default function Login() {
    const navigate = useNavigate();

    async function handleLogin(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        navigate('/login');
    }
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
            <div className="login-container">
                <form onSubmit={handleLogin}>
                    <button type="submit">Login</button>
                </form>
            </div>
            <div className="login-container">
                <form onSubmit={handleAccount}>
                    <button type="submit">Criar conta</button>
                </form>

            </div>
            <div className="login-container">
                <form onSubmit={handleProdutos}>
                    <button type="submit">Inserir Produtos</button>
                </form>
            </div>
            <Product />
        </div>
    );
}
