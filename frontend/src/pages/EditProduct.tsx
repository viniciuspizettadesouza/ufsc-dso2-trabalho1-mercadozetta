import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Textarea } from '@/components/Textarea';
import Header from '@/pages/header';
import { appRoutes } from '@/routes';
import {
  type Product,
  type ProductStatus,
  useProductDetail,
  useUpdateProductDetails,
  useUpdateProductInventory,
  useUpdateProductStatus,
} from '@/serverState/products';

export default function EditProduct() {
  const { productId } = useParams();

  return (
    <EditProductPage
      key={productId ?? 'missing-product'}
      productId={productId}
    />
  );
}

function EditProductPage({ productId }: { productId?: string }) {
  const productQuery = useProductDetail(
    productId ?? 'missing-product',
    Boolean(productId),
  );
  const loadError = productQuery.isError && productQuery.data === undefined;

  if (!productId) return null;

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[700px] px-4 py-8">
        <h1 className="text-3xl font-bold">Manage product</h1>
        {loadError && <p role="alert">Unable to load product.</p>}
        {!productQuery.data ? (
          <p role="status">Loading product...</p>
        ) : (
          <EditProductForm
            key={productQuery.data._id}
            productId={productId}
            initialProduct={productQuery.data}
          />
        )}
      </main>
    </div>
  );
}

function EditProductForm({
  productId,
  initialProduct,
}: {
  productId: string;
  initialProduct: Product;
}) {
  const [name, setName] = useState(initialProduct.name);
  const [description, setDescription] = useState(
    initialProduct.description || '',
  );
  const [category, setCategory] = useState(
    initialProduct.category || 'general',
  );
  const [subcategory, setSubcategory] = useState(
    initialProduct.subcategory || '',
  );
  const [image, setImage] = useState(initialProduct.image);
  const [inventory, setInventory] = useState(
    String(initialProduct.inventory ?? 0),
  );
  const [status, setStatus] = useState<ProductStatus>(
    initialProduct.status ?? 'draft',
  );
  const [pending, setPending] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const updateDetails = useUpdateProductDetails(productId);
  const updateInventory = useUpdateProductInventory(productId);
  const updateStatus = useUpdateProductStatus(productId);

  function applyProduct(value: Product) {
    setName(value.name);
    setDescription(value.description || '');
    setCategory(value.category || 'general');
    setSubcategory(value.subcategory || '');
    setImage(value.image);
    setInventory(String(value.inventory ?? 0));
    setStatus(value.status ?? 'draft');
  }

  async function mutate(action: string, request: () => Promise<Product>) {
    try {
      setPending(action);
      setFeedback(null);
      const response = await request();
      applyProduct(response);
      setFeedback({ type: 'success', message: 'Product updated.' });
    } catch {
      setFeedback({ type: 'error', message: 'Unable to update product.' });
    } finally {
      setPending('');
    }
  }

  return (
    <>
      {feedback && (
        <p role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.message}
        </p>
      )}
      <form
        className="mt-6 grid gap-3"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          mutate('details', () =>
            updateDetails.mutateAsync({
              name,
              description,
              category,
              subcategory,
              image,
            }),
          );
        }}
      >
        <h2 className="text-xl font-bold">Listing details</h2>
        <label>
          Name{' '}
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Description{' '}
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label>
          Category{' '}
          <Input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
        </label>
        <label>
          Subcategory{' '}
          <Input
            value={subcategory}
            onChange={(event) => setSubcategory(event.target.value)}
          />
        </label>
        <label>
          Image URL{' '}
          <Input
            value={image}
            onChange={(event) => setImage(event.target.value)}
          />
        </label>
        <Button variant="primary" disabled={Boolean(pending)} type="submit">
          {pending === 'details' ? 'Saving details...' : 'Save details'}
        </Button>
      </form>
      <form
        className="mt-8 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          mutate('inventory', () =>
            updateInventory.mutateAsync({
              inventory: Number(inventory),
            }),
          );
        }}
      >
        <h2 className="text-xl font-bold">Inventory</h2>
        <label>
          Available units{' '}
          <Input
            type="number"
            min="0"
            step="1"
            value={inventory}
            onChange={(event) => setInventory(event.target.value)}
          />
        </label>
        <Button variant="primary" disabled={Boolean(pending)} type="submit">
          {pending === 'inventory' ? 'Saving inventory...' : 'Save inventory'}
        </Button>
      </form>
      <form
        className="mt-8 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          mutate('status', () => updateStatus.mutateAsync({ status }));
        }}
      >
        <h2 className="text-xl font-bold">Lifecycle</h2>
        <label>
          Status{' '}
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as ProductStatus)}
          >
            {(['draft', 'active', 'paused', 'archived'] as const).map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </Select>
        </label>
        <Button variant="primary" disabled={Boolean(pending)} type="submit">
          {pending === 'status' ? 'Saving status...' : 'Save status'}
        </Button>
      </form>
      <Link
        className="mt-8 inline-block text-action underline"
        to={appRoutes.productDetail(productId)}
      >
        Back to product
      </Link>
    </>
  );
}
