import { Link } from 'react-router';

import Header from './header/index';
import Product from './Products';
import { useBrand } from '../brands/brandContext';
import { appRoutes } from '../routes';

export default function Index() {
  const brand = useBrand();

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[var(--brand-text)]">
      <Header />
      <main>
        <section className="border-b border-solid border-[#e5e7eb] bg-[var(--brand-primary)]">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-5 pb-8 pt-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-[680px]">
              <p className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--brand-secondary)]">
                {brand.marketplaceName}
              </p>
              <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
                {brand.copy.home.headline}
              </h1>
              <p className="mt-3 max-w-[620px] text-base leading-7 text-[#4b5563]">
                {brand.copy.home.subtitle}
              </p>
            </div>
            <nav
              aria-label={brand.copy.home.sellerActionLabel}
              className="flex flex-wrap gap-3"
            >
              <Link
                className="inline-flex h-11 items-center justify-center rounded border border-solid border-[var(--brand-secondary)] bg-white px-4 text-sm font-bold text-[var(--brand-secondary)]"
                to={appRoutes.register}
              >
                {brand.copy.home.createAccountAction}
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded bg-[var(--brand-secondary)] px-4 text-sm font-bold text-white"
                to={appRoutes.newProduct}
              >
                {brand.copy.home.createProductAction}
              </Link>
            </nav>
          </div>
        </section>
        <Product />
      </main>
    </div>
  );
}
