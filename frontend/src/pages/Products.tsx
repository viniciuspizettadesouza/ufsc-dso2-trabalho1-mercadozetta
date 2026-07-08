import { ChangeEvent, MouseEvent, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router';

import api from '../services/api';
import { useBrand } from '../brands/brandContext';
import { apiRoutes } from '../routes';

type Product = {
    _id: string;
    name: string;
    description: string;
    image: string;
    inventory?: number;
};

export default function Products() {
    const brand = useBrand();
    const { sellerId } = useParams();
    const [products, setProducts] = useState<Product[]>([]);
    const [newProducts, setNewProducts] = useState<Product[]>([]);
    const [produto, setProduto] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadProducts() {
            try {
                setIsLoading(true);
                setError('');
                const path = sellerId ? apiRoutes.sellerProducts(sellerId) : apiRoutes.products;
                const response = await api.get(path)
                setProducts(response.data)
                setNewProducts(response.data)
            } catch {
                setProducts([])
                setNewProducts([])
                setError(brand.copy.catalog.loadError)
            } finally {
                setIsLoading(false);
            }
        }
        loadProducts();
    }, [brand.copy.catalog.loadError, sellerId]);

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
                    className="mt-2.5 flex h-12 w-full max-w-[300px] cursor-pointer flex-col items-center justify-center rounded border-0 bg-[var(--brand-secondary)] text-base font-bold text-white"
                    type="submit"
                    value={produto}
                    onClick={procure}
                >
                    {brand.copy.catalog.searchAction}
                </button>
            </div>
            <div className="flex h-full items-center justify-center">
                <input
                    className="mt-2.5 flex h-12 w-full max-w-[300px] self-center rounded border-0 text-center"
                    type="text"
                    placeholder={brand.copy.catalog.searchPlaceholder}
                    value={produto}
                    onChange={procure}
                />
            </div>

            <div className="mx-auto max-w-[980px] px-0 py-[50px] text-center">
                {isLoading ? (
                    <div role="status" className="text-[32px] font-bold text-[#999]">
                        {brand.copy.catalog.loading}
                    </div>
                ) : error ? (
                    <div role="alert" className="text-[32px] font-bold text-[#999]">
                        {error}
                    </div>
                ) : newProducts.length > 0 ? (
                    <ul className="mt-[50px] grid list-none grid-cols-4 gap-[30px] max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
                        {newProducts.map(product => (
                            <li className="flex flex-col" key={product._id}>
                                <img className="max-w-full" src={product.image} alt={product.name} />
                                <div>
                                    <p className="overflow-hidden whitespace-nowrap">
                                        {product.name}
                                    </p>
                                    <p className="h-14 w-[223px] overflow-hidden text-ellipsis">
                                        {brand.copy.catalog.descriptionLabel}
                                    </p>
                                    <p className="h-14 w-[223px] overflow-hidden text-ellipsis">
                                        {product.description}
                                    </p>
                                    {brand.features.inventory && product.inventory !== undefined && (
                                        <p className="h-8 w-[223px] overflow-hidden text-ellipsis font-bold text-[var(--brand-accent)]">
                                            {product.inventory > 0
                                                ? `${brand.copy.catalog.inventoryLabel} ${product.inventory}`
                                                : brand.copy.catalog.soldOutLabel}
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-[32px] font-bold text-[#999]">
                        <h1>{brand.copy.catalog.empty}</h1>
                    </div>
                )}
            </div>
        </div>
    );
}
