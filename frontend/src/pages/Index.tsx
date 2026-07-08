import { useNavigate } from 'react-router';
import { FormEvent } from 'react';

import Header from './header/index';
import Product from './Products';
import { useBrand } from '../brands/brandContext';
import { appRoutes } from '../routes';

export default function Index() {
    const brand = useBrand();
    const navigate = useNavigate();

    async function handleAccount(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        navigate(appRoutes.register);
    }
    async function handleProducts(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        navigate(appRoutes.newProduct);
    }

    return (
        <div>
            <Header />
            <div className="flex h-full items-center justify-center">
                <form className="flex w-full max-w-[300px] flex-col" onSubmit={handleAccount}>
                    <button
                        className="mt-2.5 h-12 cursor-pointer rounded border-0 bg-[var(--brand-secondary)] text-base font-bold text-white"
                        type="submit"
                    >
                        {brand.copy.home.createAccountAction}
                    </button>
                </form>

            </div>
            <div className="flex h-full items-center justify-center">
                <form className="flex w-full max-w-[300px] flex-col" onSubmit={handleProducts}>
                    <button
                        className="mt-2.5 h-12 cursor-pointer rounded border-0 bg-[var(--brand-secondary)] text-base font-bold text-white"
                        type="submit"
                    >
                        {brand.copy.home.createProductAction}
                    </button>
                </form>
            </div>
            <Product />
        </div>
    );
}
