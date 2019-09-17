import React from 'react';
import { Link } from 'react-router-dom';
import './Index.css';

import logo from '../assets/logo.svg'

export default function Login({ history }) {
    async function handleLogin(e) {
        e.preventDefault();
        history.push(`/login`);
    }
    async function handleAccount(e) {
        e.preventDefault();
        history.push(`/add-user`);
    }
    async function handleProdutos(e) {
        e.preventDefault();
        history.push(`/user/:_id`);
    }

    return (
        <div>
            <div className="login-container">
                <Link to="/">
                    <img src={logo} alt="logo" />
                </Link>
            </div>
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
                    <button type="submit">Produtos</button>
                </form>
            </div>
        </div>
    );
}
