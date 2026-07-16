import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import Header from '@/pages/header';
import api from '@/services/api';
import { apiRoutes, appRoutes } from '@/routes';

type ProductStatus = 'draft' | 'active' | 'paused' | 'sold_out' | 'archived';
type Product = {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  image: string;
  inventory: number;
  status: ProductStatus;
};

export default function EditProduct() {
  const { productId } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [subcategory, setSubcategory] = useState('');
  const [image, setImage] = useState('');
  const [inventory, setInventory] = useState('0');
  const [status, setStatus] = useState<ProductStatus>('draft');
  const [pending, setPending] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  function applyProduct(value: Product) {
    setProduct(value);
    setName(value.name);
    setDescription(value.description || '');
    setCategory(value.category || 'general');
    setSubcategory(value.subcategory || '');
    setImage(value.image);
    setInventory(String(value.inventory));
    setStatus(value.status);
  }

  useEffect(() => {
    if (!productId) return;
    api
      .get(apiRoutes.productDetail(productId))
      .then((response) => applyProduct(response.data))
      .catch(() =>
        setFeedback({ type: 'error', message: 'Unable to load product.' }),
      );
  }, [productId]);

  async function mutate(path: string, body: object, action: string) {
    try {
      setPending(action);
      setFeedback(null);
      const response = await api.patch(path, body);
      applyProduct(response.data);
      setFeedback({ type: 'success', message: 'Product updated.' });
    } catch {
      setFeedback({ type: 'error', message: 'Unable to update product.' });
    } finally {
      setPending('');
    }
  }

  if (!productId) return null;
  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[700px] px-4 py-8">
        <h1 className="text-3xl font-bold">Manage product</h1>
        {feedback && (
          <p role={feedback.type === 'error' ? 'alert' : 'status'}>
            {feedback.message}
          </p>
        )}
        {!product ? (
          <p role="status">Loading product...</p>
        ) : (
          <>
            <form
              className="mt-6 grid gap-3"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                mutate(
                  apiRoutes.productDetail(productId),
                  { name, description, category, subcategory, image },
                  'details',
                );
              }}
            >
              <h2 className="text-xl font-bold">Listing details</h2>
              <label>
                Name{' '}
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                Description{' '}
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label>
                Category{' '}
                <input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                />
              </label>
              <label>
                Subcategory{' '}
                <input
                  value={subcategory}
                  onChange={(event) => setSubcategory(event.target.value)}
                />
              </label>
              <label>
                Image URL{' '}
                <input
                  value={image}
                  onChange={(event) => setImage(event.target.value)}
                />
              </label>
              <button disabled={Boolean(pending)} type="submit">
                {pending === 'details' ? 'Saving details...' : 'Save details'}
              </button>
            </form>
            <form
              className="mt-8 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                mutate(
                  apiRoutes.productInventory(productId),
                  { inventory: Number(inventory) },
                  'inventory',
                );
              }}
            >
              <h2 className="text-xl font-bold">Inventory</h2>
              <label>
                Available units{' '}
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={inventory}
                  onChange={(event) => setInventory(event.target.value)}
                />
              </label>
              <button disabled={Boolean(pending)} type="submit">
                {pending === 'inventory'
                  ? 'Saving inventory...'
                  : 'Save inventory'}
              </button>
            </form>
            <form
              className="mt-8 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                mutate(
                  apiRoutes.productStatus(productId),
                  { status },
                  'status',
                );
              }}
            >
              <h2 className="text-xl font-bold">Lifecycle</h2>
              <label>
                Status{' '}
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as ProductStatus)
                  }
                >
                  {(['draft', 'active', 'paused', 'archived'] as const).map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <button disabled={Boolean(pending)} type="submit">
                {pending === 'status' ? 'Saving status...' : 'Save status'}
              </button>
            </form>
            <Link
              className="mt-8 inline-block"
              to={appRoutes.productDetail(productId)}
            >
              Back to product
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
