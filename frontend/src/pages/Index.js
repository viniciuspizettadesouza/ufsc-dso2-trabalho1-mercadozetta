import React from 'react';
import './Index.css';

import logo from '../assets/logo.svg'

export default function Login({ history }) {
    async function handleLogin(e) {
        e.preventDefault();

        history.push(`/login`);
    }
    async function handleRegister(e) {
        e.preventDefault();

        history.push(`/register`);
    }
    async function handleProdutos(e) {
        e.preventDefault();

        history.push(`/user/:id`);
    }

    return (
        <div>
            <div className="login-container">
                <img src={logo} alt="logo" />
            </div>
            <div className="login-container">
                <form onSubmit={handleLogin}>
                    <button type="submit">Login</button>
                </form>
            </div>            
            <div className="login-container">
                <form onSubmit={handleRegister}>
                    <button type="submit">Criar conta</button>
                </form>
            </div>
            <div className="login-container">
                <form onSubmit={handleProdutos}>
                    <button type="submit">Produtos</button>
                </form>
            </div>
        </div>

    );
}
