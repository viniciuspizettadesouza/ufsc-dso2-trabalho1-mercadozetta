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
            setProducts(response.data);
        }
        loadProducts();
    });

    const procure = useCallback(event => { 
        setProduto(event.target.value)
        if(event.target.value.length > 1) {
            setNewProducts(products.filter(p => console.log(stringSimilarity.compareTwoStrings(p.name,produto)) || stringSimilarity.compareTwoStrings(p.name,produto) > 0.1))
            console.log(newProducts)
        } else if (event.target.value.length === 0) {
            setNewProducts(products)
        }}
        , [newProducts, produto, products])


    return (
        <div className="products-flexbox">
        <input type="text" placeholder="Procure um produto" value={produto} onChange={procure} />
            <div className="product-container">
                <ul>
                    {newProducts.map(product => (
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
