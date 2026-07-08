import { ChangeEvent, MouseEvent, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router';

import api from '../services/api';
import { apiRoutes } from '../routes';

type Product = {
    _id: string;
    name: string;
    description: string;
    image: string;
};

export default function Products() {
    const { sellerId } = useParams();
    const [products, setProducts] = useState<Product[]>([]);
    const [newProducts, setNewProducts] = useState<Product[]>([]);
    const [produto, setProduto] = useState('');

    useEffect(() => {
        async function loadProducts() {
            const path = sellerId ? apiRoutes.sellerProducts(sellerId) : apiRoutes.products;
            const response = await api.get(path)
            setProducts(response.data)
            setNewProducts(response.data)
        }
        loadProducts();
    }, [sellerId]);

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
        <div className="flex flex-col content-center justify-items-center">
            <div className="flex h-full items-center justify-center">
                <button
                    className="mt-2.5 flex h-12 w-full max-w-[300px] cursor-pointer flex-col items-center justify-center rounded border-0 bg-[#3483fa] text-base font-bold text-white"
                    type="submit"
                    value={produto}
                    onClick={procure}
                >
                    Buscar Produtos
                </button>
            </div>
            <div className="flex h-full items-center justify-center">
                <input
                    className="mt-2.5 flex h-12 w-full max-w-[300px] self-center rounded border-0 text-center"
                    type="text"
                    placeholder="Procure um produto"
                    value={produto}
                    onChange={procure}
                />
            </div>

            <div className="mx-auto max-w-[980px] px-0 py-[50px] text-center">
                {newProducts.length > 0 ? (
                    <ul className="mt-[50px] grid list-none grid-cols-4 gap-[30px] max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
                        {newProducts.map(product => (
                            <li className="flex flex-col" key={product._id}>
                                <img className="max-w-full" src={product.image} alt="produto" />
                                <div>
                                    <p className="overflow-hidden whitespace-nowrap">
                                        {product.name}
                                    </p>
                                    <p className="h-14 w-[223px] overflow-hidden text-ellipsis">
                                        Descrição do produto:
                                    </p>
                                    <p className="h-14 w-[223px] overflow-hidden text-ellipsis">
                                        {product.description}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-[32px] font-bold text-[#999]">
                        <h1>Nenhum produto encontrado :(</h1>
                    </div>
                )}
            </div>
        </div>
    );
}
