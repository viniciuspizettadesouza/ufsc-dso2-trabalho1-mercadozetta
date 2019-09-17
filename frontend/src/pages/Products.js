import React, { useEffect, useState } from 'react';
import './Index.css';

import Header from './header';
import api from '../services/api';

export default function Products({ match, history }) {
    const [products, setProducts] = useState([]);

    async function handleProdutos(e) {
        e.preventDefault();
        history.push(`/add-product`);
    }
    useEffect(() => {
        async function loadProducts() {
            const response = await api.get('/products', {
                headers: {
                    product: match.params.id,
                }
            })
            setProducts(response.data);
        }
        loadProducts();
    }, [match.params.id]);

    return (
        <div>
            <Header />
            <div className="login-container">
                <form onSubmit={handleProdutos}>
                    <button type="submit">Inserir Produtos</button>
                </form>
            </div>
            <div className="product-container">
                <ul>
                    {products.map(product => (
                        <li key={product._id}>
                            <img src="https://www.gsuplementos.com.br/upload/produto/imagem/creatina-250g-creapure-growth-supplements.jpg" alt="produto" />
                            <footer>
                                <strong>{product.name}</strong>
                                <p>{product.description}</p>
                            </footer>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
