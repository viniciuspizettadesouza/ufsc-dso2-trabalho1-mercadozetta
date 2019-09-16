import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Main.css';

import api from '../services/api';

import logo from '../assets/logo.svg'

export default function Main({ match }) {
    const [products, setProducts] = useState([]);

    useEffect(() => {
        async function loadProducts() {
            const response = await api.get('/register', {
                headers: {
                    product: match.params.id,
                }
            })
            setProducts(response.data);
        }
        loadProducts();
    }, [match.params.id]);

    return (
        <div className="main-container">
            <Link to="/">
                <img src={logo} alt="Tindev" />
            </Link>
            <img src={logo} alt="logo" />
            <ul>
                {products.map(user => (
                    <li>
                        <img src="https://www.gsuplementos.com.br/upload/produto/imagem/creatina-250g-creapure-growth-supplements.jpg" alt="creatina" />
                        <footer>
                            <strong>{user.product}</strong>
                            <p>GROWTH SUPPLEMENTS</p>
                        </footer>
                    </li>
                ))}
            </ul>
        </div>

    );
}
