import { Link, useParams } from 'react-router';

import Header from '@/pages/header';
import { appRoutes } from '@/routes';
import { useProductList } from '@/serverState/products';
import { useSellerProfile } from '@/serverState/sellers';

export default function SellerProfile() {
  const { sellerId } = useParams();

  return (
    <SellerProfilePage key={sellerId ?? 'missing-seller'} sellerId={sellerId} />
  );
}

function SellerProfilePage({ sellerId }: { sellerId?: string }) {
  const enabled = Boolean(sellerId);
  const sellerQuery = useSellerProfile(sellerId ?? 'missing-seller', enabled);
  const productsQuery = useProductList(
    {
      sellerId: sellerId ?? 'missing-seller',
      q: '',
      category: '',
      availability: '',
      sort: '',
      limit: null,
      offset: null,
    },
    enabled,
  );
  const loadError =
    (sellerQuery.isError && sellerQuery.data === undefined) ||
    (productsQuery.isError && productsQuery.data === undefined);
  const seller = sellerQuery.data;
  const products = productsQuery.data?.items ?? [];

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[900px] px-4 py-8">
        {loadError ? (
          <p role="alert" className="text-xl font-bold text-red-700">
            Unable to load seller profile.
          </p>
        ) : !seller || productsQuery.data === undefined ? (
          <p role="status" className="text-xl font-bold text-muted">
            Loading seller...
          </p>
        ) : (
          <>
            <section className="rounded-surface border border-solid border-theme-border bg-surface p-5 shadow-surface">
              <h1 className="text-3xl font-bold">
                {seller.storeName || 'Seller store'}
              </h1>
              <p className="mt-2 text-muted">{seller.username || 'Seller'}</p>
              {seller.telephone && (
                <p className="text-muted">Contact: {seller.telephone}</p>
              )}
              {seller.email && <p className="text-muted">{seller.email}</p>}
            </section>
            <section className="mt-8">
              <h2 className="text-xl font-bold">Seller products</h2>
              <ul className="mt-3 space-y-2">
                {products.map((product) => (
                  <li
                    className="rounded-surface border border-solid border-theme-border bg-surface p-3"
                    key={product._id}
                  >
                    <Link
                      className="font-bold text-action"
                      to={appRoutes.productDetail(product._id)}
                    >
                      {product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
