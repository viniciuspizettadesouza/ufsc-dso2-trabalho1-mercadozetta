import React, { useEffect, useState } from 'react';
import './Index.css';

import api from '../services/api';

export default function Products({ history }) {
    const [products, setProducts] = useState([]);

    useEffect(() => {
        async function loadProducts() {
            const response = await api.get('/products', {

            })
            setProducts(response.data);
        }
        loadProducts();
    });

    return (
        <div>
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
