import { ChangeEvent, MouseEvent, useEffect, useState, useCallback } from 'react';
import './Index.css';

import api from '../services/api';

type Product = {
    _id: string;
    name: string;
    description: string;
    image: string;
};

export default function Products() {
    const [products, setProducts] = useState<Product[]>([]);
    const [newProducts, setNewProducts] = useState<Product[]>([]);
    const [produto, setProduto] = useState('');

    useEffect(() => {
        async function loadProducts() {
            const response = await api.get('/products', {

            })
            setProducts(response.data)
            setNewProducts(response.data)
        }
        loadProducts();
    }, []);

    const procure = useCallback((event: ChangeEvent<HTMLInputElement> | MouseEvent<HTMLButtonElement>) => {
        const value = event.currentTarget.value;

        setProduto(value)
        if (value.length > 1) {
            setNewProducts(products.filter(p => p.name.toLowerCase().includes(value.toLowerCase())))
        } else if (value.length === 0) {
            setNewProducts(products)
        }
    }, [products])

    return (
        <div className="product-flexbox">
            <div className="login-container">
                <button type="submit" value={produto} onClick={procure}>
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
