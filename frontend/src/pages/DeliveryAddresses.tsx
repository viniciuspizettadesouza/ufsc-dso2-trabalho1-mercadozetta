import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import {
  MutationFeedbackMessage,
  type MutationFeedback,
} from '@/components/MutationFeedback';
import Header from '@/pages/header';
import { appRoutes } from '@/routes';
import {
  useCreateDeliveryAddress,
  useDeleteDeliveryAddress,
  useDeliveryAddresses,
  useUpdateDeliveryAddress,
} from '@/serverState/delivery';
import type {
  DeliveryAddress,
  DeliveryAddressInput,
} from '@/services/delivery';
import { getApiErrorMessage } from '@/services/errors';

function formInput(form: HTMLFormElement): DeliveryAddressInput {
  const data = new FormData(form);
  return {
    label: String(data.get('label') || ''),
    recipientName: String(data.get('recipientName') || ''),
    line1: String(data.get('line1') || ''),
    line2: String(data.get('line2') || '') || null,
    city: String(data.get('city') || ''),
    region: String(data.get('region') || '') || null,
    postalCode: String(data.get('postalCode') || ''),
    countryCode: String(data.get('countryCode') || ''),
    telephone: String(data.get('telephone') || ''),
    isDefault: data.get('isDefault') === 'on',
  };
}

function AddressForm({
  current,
  pending,
  onCancel,
  onSubmit,
}: {
  current: DeliveryAddress | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: DeliveryAddressInput) => Promise<void>;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await onSubmit(formInput(form));
    if (!current) form.reset();
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <label htmlFor="address-label">Address label</label>
      <Input
        id="address-label"
        name="label"
        defaultValue={current?.label}
        required
      />
      <label htmlFor="address-recipient">Recipient name</label>
      <Input
        id="address-recipient"
        name="recipientName"
        autoComplete="name"
        defaultValue={current?.recipientName}
        required
      />
      <label htmlFor="address-line1">Address line 1</label>
      <Input
        id="address-line1"
        name="line1"
        autoComplete="address-line1"
        defaultValue={current?.line1}
        required
      />
      <label htmlFor="address-line2">Address line 2 (optional)</label>
      <Input
        id="address-line2"
        name="line2"
        autoComplete="address-line2"
        defaultValue={current?.line2 ?? ''}
      />
      <label htmlFor="address-city">City</label>
      <Input
        id="address-city"
        name="city"
        autoComplete="address-level2"
        defaultValue={current?.city}
        required
      />
      <label htmlFor="address-region">Region/state (optional)</label>
      <Input
        id="address-region"
        name="region"
        autoComplete="address-level1"
        defaultValue={current?.region ?? ''}
      />
      <label htmlFor="address-postal">Postal code</label>
      <Input
        id="address-postal"
        name="postalCode"
        autoComplete="postal-code"
        defaultValue={current?.postalCode}
        placeholder="1000-001"
        required
      />
      <label htmlFor="address-country">Country code</label>
      <Input
        id="address-country"
        name="countryCode"
        autoComplete="country"
        defaultValue={current?.countryCode ?? 'PT'}
        maxLength={2}
        required
      />
      <label htmlFor="address-telephone">Telephone</label>
      <Input
        id="address-telephone"
        name="telephone"
        autoComplete="tel"
        defaultValue={current?.telephone}
        required
      />
      <label className="flex items-center gap-2">
        <input
          name="isDefault"
          type="checkbox"
          defaultChecked={current?.isDefault ?? false}
        />
        Use as default address
      </label>
      <div className="flex gap-3">
        <Button
          aria-busy={pending}
          disabled={pending}
          type="submit"
          variant="primary"
        >
          {pending
            ? 'Saving address...'
            : current
              ? 'Update address'
              : 'Add address'}
        </Button>
        {current && (
          <Button disabled={pending} type="button" onClick={onCancel}>
            Cancel edit
          </Button>
        )}
      </div>
    </form>
  );
}

export default function DeliveryAddresses() {
  const { user } = useAuth();
  const userId = user?._id ?? 'anonymous';
  const query = useDeliveryAddresses(userId);
  const createAddress = useCreateDeliveryAddress(userId);
  const updateAddress = useUpdateDeliveryAddress(userId);
  const deleteAddress = useDeleteDeliveryAddress(userId);
  const [editing, setEditing] = useState<DeliveryAddress | null>(null);
  const [feedback, setFeedback] = useState<MutationFeedback>(null);
  const pending =
    createAddress.isPending ||
    updateAddress.isPending ||
    deleteAddress.isPending;

  async function save(input: DeliveryAddressInput) {
    try {
      setFeedback(null);
      if (editing) {
        await updateAddress.mutateAsync({ addressId: editing._id, input });
        setEditing(null);
        setFeedback({ type: 'success', message: 'Delivery address updated.' });
      } else {
        await createAddress.mutateAsync(input);
        setFeedback({ type: 'success', message: 'Delivery address added.' });
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Unable to save delivery address.'),
      });
    }
  }

  async function remove(address: DeliveryAddress) {
    try {
      setFeedback(null);
      await deleteAddress.mutateAsync(address._id);
      if (editing?._id === address._id) setEditing(null);
      setFeedback({
        type: 'success',
        message: address.isDefault
          ? 'Default address deleted. Another saved address is now the default when available.'
          : 'Delivery address deleted.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(
          error,
          'Unable to delete delivery address.',
        ),
      });
    }
  }

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-[900px] px-4 py-8">
        <h1 className="text-3xl font-bold">Delivery addresses</h1>
        <p className="mt-2">
          Saved addresses are used for delivery and copied into an immutable
          order snapshot when checkout succeeds.
        </p>
        <MutationFeedbackMessage className="mt-4" feedback={feedback} />
        <section className="mt-6">
          <h2 className="text-xl font-bold">Saved addresses</h2>
          {query.isPending ? (
            <p role="status">Loading delivery addresses...</p>
          ) : query.isError ? (
            <p role="alert">Unable to load delivery addresses.</p>
          ) : query.data?.length ? (
            <ul className="mt-3 space-y-3">
              {query.data.map((address) => (
                <li
                  className="rounded-surface border border-theme-border bg-surface p-4"
                  key={address._id}
                >
                  <strong>
                    {address.label}
                    {address.isDefault ? ' (default)' : ''}
                  </strong>
                  <address className="not-italic">
                    {address.recipientName}, {address.line1}
                    {address.line2 ? `, ${address.line2}` : ''}, {address.city},{' '}
                    {address.postalCode}, {address.countryCode}
                  </address>
                  <div className="mt-2 flex gap-2">
                    <Button
                      disabled={pending}
                      onClick={() => setEditing(address)}
                    >
                      Edit {address.label}
                    </Button>
                    <Button disabled={pending} onClick={() => remove(address)}>
                      Delete {address.label}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No delivery addresses saved.</p>
          )}
        </section>
        <section className="mt-8 rounded-surface border border-theme-border bg-surface p-5">
          <h2 className="mb-4 text-xl font-bold">
            {editing ? `Edit ${editing.label}` : 'Add a delivery address'}
          </h2>
          <AddressForm
            key={editing?._id ?? 'new'}
            current={editing}
            pending={pending}
            onCancel={() => setEditing(null)}
            onSubmit={save}
          />
        </section>
        <div className="mt-6 flex gap-4">
          <Link to={appRoutes.checkout}>Return to checkout</Link>
          <Link to={appRoutes.account}>Account settings</Link>
        </div>
      </main>
    </div>
  );
}
