import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { isAxiosError } from 'axios';

import Header from '@/pages/header';
import api from '@/services/api';
import { useBrand } from '@/brands/brandContext';
import { apiRoutes, appRoutes } from '@/routes';
import { useAuth } from '@/auth/AuthContext';

type ProductStatus = 'draft' | 'active' | 'paused' | 'sold_out' | 'archived';

const productStatusOptions: ProductStatus[] = [
  'draft',
  'active',
  'paused',
  'sold_out',
  'archived',
];

export default function AddProduct() {
  const brand = useBrand();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [subcategory, setSubcategory] = useState('');
  const [inventory, setInventory] = useState('');
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

      await api.post(apiRoutes.products, {
        name,
        description,
        category,
        subcategory,
        inventory: Number(inventory),
        image,
        status,
      });

      navigate(appRoutes.sellerProducts(user._id));
    } catch (err) {
      if (isAxiosError<{ error?: string }>(err) && err.response?.data.error) {
        setError(err.response.data.error);
        return;
      }

      setError(brand.copy.validation.productCreateError);
    }
  }

  return (
    <div>
      <Header />
      <div className="flex h-full items-center justify-center">
        <form
          className="flex w-full max-w-[300px] flex-col"
          onSubmit={handleSubmit}
        >
          <input
            className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
            type="text"
            placeholder="Product name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
            type="text"
            placeholder="Product description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label
            className="mt-5 text-sm font-medium text-[#666]"
            htmlFor="product-category"
          >
            {brand.copy.forms.categoryLabel}
          </label>
          <input
            id="product-category"
            className="mt-2 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <label
            className="mt-5 text-sm font-medium text-[#666]"
            htmlFor="product-subcategory"
          >
            {brand.copy.forms.subcategoryLabel}
          </label>
          <input
            id="product-subcategory"
            className="mt-2 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
            type="text"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
          />
          <input
            className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
            type="number"
            min="0"
            step="1"
            placeholder="Quantity"
            value={inventory}
            onChange={(e) => setInventory(e.target.value)}
          />
          <input
            aria-label={brand.copy.forms.uploadImageLabel}
            className="mt-5 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666] placeholder:text-[#999]"
            type="text"
            placeholder="Image URL"
            value={image}
            onChange={(e) => setImage(e.target.value)}
          />
          <label
            className="mt-5 text-sm font-medium text-[#666]"
            htmlFor="product-status"
          >
            {brand.copy.forms.productStatusLabel}
          </label>
          <select
            id="product-status"
            className="mt-2 h-12 rounded border border-solid border-[#ddd] px-5 text-base text-[#666]"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProductStatus)}
          >
            {productStatusOptions.map((option) => (
              <option key={option} value={option}>
                {brand.copy.catalog.statusLabels[option]}
              </option>
            ))}
          </select>
          {error && (
            <p className="mt-3 text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            className="mt-2.5 h-12 cursor-pointer rounded border-0 bg-[var(--brand-secondary)] text-base font-bold text-white"
            type="submit"
          >
            {brand.copy.forms.createProductAction}
          </button>
        </form>
      </div>
    </div>
  );
}
