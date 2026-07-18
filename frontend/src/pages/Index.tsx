import { Link } from 'react-router';

import Header from '@/pages/header/index';
import Product from '@/pages/Products';
import { useBrand } from '@/brands/brandContext';
import { appRoutes } from '@/routes';

export default function Index() {
  const brand = useBrand();

  return (
    <div className="min-h-screen bg-canvas text-content">
      <Header />
      <main>
        <section className="border-b border-solid border-theme-border bg-surface-emphasized">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-5 pt-6 pb-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-[680px]">
              <p className="text-sm font-bold tracking-[0.08em] text-action uppercase">
                {brand.marketplaceName}
              </p>
              <h1 className="mt-2 text-3xl leading-tight font-bold md:text-4xl">
                {brand.copy.home.headline}
              </h1>
              <p className="mt-3 max-w-[620px] text-base leading-7 text-muted">
                {brand.copy.home.subtitle}
              </p>
            </div>
            <nav
              aria-label={brand.copy.home.sellerActionLabel}
              className="flex flex-wrap gap-3"
            >
              <Link
                className="inline-flex h-11 items-center justify-center rounded-control border border-solid border-action bg-surface px-4 text-sm font-bold text-action"
                to={appRoutes.register}
              >
                {brand.copy.home.createAccountAction}
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-control bg-action px-4 text-sm font-bold text-on-action"
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
