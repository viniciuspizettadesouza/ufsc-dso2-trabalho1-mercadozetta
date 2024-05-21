import { useEffect, useState, useCallback } from 'react';
import './Index.css';
import stringSimilarity from 'string-similarity'

import api from '../services/api';

export default function Products() {
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
            setNewProducts(products.filter(p => stringSimilarity.compareTwoStrings(p.name, produto) || stringSimilarity.compareTwoStrings(p.name, produto) > 0.1))
        } else if (event.target.value.length === 0) {
            setNewProducts(products)
        }
    }, [produto, products])

    return (
        <div className="product-flexbox">
            <div className="login-container">
                <button type="submit" placeholder="Buscar Produtos" value={produto} onClick={procure}>
                    Buscar Produtos
                </button>
            </div>
            <div className="login-container">
                <input type="text" placeholder="Procure um produto" value={produto} onChange={procure} />
            </div>

            <div className="product-container">
                {newProducts.length > 0 ? (
                    <ul>
                        {newProducts.map(product => (
                            <li key={product._id}>
                                <img src={product.image} alt="produto" />
                                <div>
                                    <p className="title">
                                        {product.name}
                                    </p>
                                    <p className="description">
                                        Descrição do produto:
                                    </p>
                                    <p className="description">
                                        {product.description}
                                    </p>
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
