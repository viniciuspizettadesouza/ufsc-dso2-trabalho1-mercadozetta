import React, { useEffect, useState, useCallback } from 'react';
import './Index.css';
import stringSimilarity from 'string-similarity'

import api from '../services/api';

export default function Products({ history }) {
    const [products, setProducts] = useState([]);
    const [newProducts, setNewProducts] = useState([]);
    const [produto, setProduto] = useState('');


    useEffect(() => {
        async function loadProducts() {
            const response = await api.get('/products', {

            })
            setProducts(response.data)
        }
        loadProducts();
    });

    const procure = useCallback(event => {
        setProduto(event.target.value)
        if (event.target.value.length > 1) {
            setNewProducts(products.filter(p => console.log(stringSimilarity.compareTwoStrings(p.name, produto)) || stringSimilarity.compareTwoStrings(p.name, produto) > 0.1))
        } else if (event.target.value.length === 0) {
            setNewProducts(products)
        }
    }, [produto, products])

    return (
        <div className="product-flexbox">
            <div className="login-container">
                <button type="submit" placeholder="Procure um produto" value={produto} onClick={procure}>
                    Buscar Produtos
                </button>
            </div>
            <input type="text" placeholder="Procure um produto" value={produto} onChange={procure} />


            <div className="product-container">
                {newProducts.length > 0 ? (
                    <ul>
                        {newProducts.map(product => (
                            <li key={product._id}>
                                <img src="https://www.gsuplementos.com.br/upload/produto/imagem/creatina-250g-creapure-growth-supplements.jpg" alt="produto" />
                                <div>
                                    <p>{product.name}</p>
                                    <p>{product.description}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                        <div className="empty">
                            <h1>Nenhum produto encontrado :(</h1>
                        </div>
                    )}


            </div>
        </div>
    );
}
