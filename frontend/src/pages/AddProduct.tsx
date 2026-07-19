import { FormEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import Header from '@/pages/header';
import { useBrand } from '@/brands/brandContext';
import { appRoutes } from '@/routes';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { type ProductStatus, useCreateProduct } from '@/serverState/products';
import { getApiErrorMessage } from '@/services/errors';
import { createIdempotencyKey } from '@/services/idempotency';
import { majorInputToMinor } from '@/money';

const productStatusOptions: ProductStatus[] = [
  'draft',
  'active',
  'paused',
  'archived',
];

export default function AddProduct() {
  const brand = useBrand();
  const navigate = useNavigate();
  const { user } = useAuth();
  const createProduct = useCreateProduct();
  const idempotency = useRef<{ key: string; fingerprint: string } | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [subcategory, setSubcategory] = useState('');
  const [inventory, setInventory] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');
  const [status, setStatus] = useState<ProductStatus>('active');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user?._id) {
      setError(brand.copy.validation.loginRequiredForProduct);
      return;
    }

    try {
      setError('');

      const amountMinor = majorInputToMinor(price);
      if (amountMinor === null) {
        setError(
          `Enter a valid ${brand.currency} price with at most 2 decimals.`,
        );
        return;
      }

      const product = {
        name,
        description,
        category,
        subcategory,
        inventory: Number(inventory),
        price: { currency: brand.currency, amountMinor },
        image,
        status,
      };
      const fingerprint = JSON.stringify(product);
      if (idempotency.current?.fingerprint !== fingerprint) {
        idempotency.current = { key: createIdempotencyKey(), fingerprint };
      }
      await createProduct.mutateAsync({
        ...product,
        idempotencyKey: idempotency.current.key,
      });

      navigate(appRoutes.sellerProducts(user._id));
    } catch (error) {
      setError(
        getApiErrorMessage(error, brand.copy.validation.productCreateError),
      );
    }
  }

  return (
    <div>
      <Header />
      <main className="flex h-full items-center justify-center">
        <form
          aria-describedby={error ? 'product-form-error' : undefined}
          className="flex w-full max-w-[300px] flex-col"
          onSubmit={handleSubmit}
        >
          <h1 className="mt-5 text-center text-2xl font-bold">
            {brand.copy.forms.createProductAction}
          </h1>
          <label className="sr-only" htmlFor="product-name">
            Product name
          </label>
          <Input
            id="product-name"
            className="mt-5 h-12 px-5 text-base"
            type="text"
            placeholder="Product name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="sr-only" htmlFor="product-description">
            Product description
          </label>
          <Input
            id="product-description"
            className="mt-5 h-12 px-5 text-base"
            type="text"
            placeholder="Product description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label
            className="mt-5 text-sm font-medium text-muted"
            htmlFor="product-category"
          >
            {brand.copy.forms.categoryLabel}
          </label>
          <Input
            id="product-category"
            className="mt-2 h-12 px-5 text-base"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <label
            className="mt-5 text-sm font-medium text-muted"
            htmlFor="product-subcategory"
          >
            {brand.copy.forms.subcategoryLabel}
          </label>
          <Input
            id="product-subcategory"
            className="mt-2 h-12 px-5 text-base"
            type="text"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
          />
          <label className="sr-only" htmlFor="product-inventory">
            Quantity
          </label>
          <Input
            id="product-inventory"
            className="mt-5 h-12 px-5 text-base"
            type="number"
            min="0"
            step="1"
            placeholder="Quantity"
            value={inventory}
            onChange={(e) => setInventory(e.target.value)}
          />
          <label className="sr-only" htmlFor="product-price">
            Price ({brand.currency})
          </label>
          <Input
            id="product-price"
            className="mt-5 h-12 px-5 text-base"
            type="number"
            min="0"
            step="0.01"
            placeholder={`Price (${brand.currency})`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Input
            aria-label={brand.copy.forms.uploadImageLabel}
            className="mt-5 h-12 px-5 text-base"
            type="text"
            placeholder="Image URL"
            value={image}
            onChange={(e) => setImage(e.target.value)}
          />
          <label
            className="mt-5 text-sm font-medium text-muted"
            htmlFor="product-status"
          >
            {brand.copy.forms.productStatusLabel}
          </label>
          <Select
            id="product-status"
            className="mt-2 h-12 px-5 text-base"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProductStatus)}
          >
            {productStatusOptions.map((option) => (
              <option key={option} value={option}>
                {brand.copy.catalog.statusLabels[option]}
              </option>
            ))}
          </Select>
          {error && (
            <p
              id="product-form-error"
              className="mt-3 text-sm font-medium text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
          <Button
            aria-busy={createProduct.isPending}
            className="mt-2.5 h-12 text-base"
            disabled={createProduct.isPending}
            variant="primary"
            type="submit"
          >
            {brand.copy.forms.createProductAction}
          </Button>
        </form>
      </main>
    </div>
  );
}
