export type DeliveryAddress = {
  _id: string;
  tenantId: string;
  userId: string;
  label: string;
  recipientName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  countryCode: string;
  telephone: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type DeliveryAddressFields = Omit<
  DeliveryAddress,
  '_id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'
>;

export type DeliveryAddressSnapshot = Omit<
  DeliveryAddressFields,
  'isDefault'
> & { sourceAddressId: string };

export interface DeliveryAddressRepository {
  list(tenantId: string, userId: string): Promise<DeliveryAddress[]>;
  count(tenantId: string, userId: string): Promise<number>;
  findById(
    tenantId: string,
    userId: string,
    addressId: string,
  ): Promise<DeliveryAddress | null>;
  findByIdForUpdate(
    tenantId: string,
    userId: string,
    addressId: string,
  ): Promise<DeliveryAddress | null>;
  create(
    tenantId: string,
    userId: string,
    fields: DeliveryAddressFields,
    now: Date,
  ): Promise<DeliveryAddress>;
  update(
    tenantId: string,
    userId: string,
    addressId: string,
    fields: DeliveryAddressFields,
    now: Date,
  ): Promise<DeliveryAddress | null>;
  delete(tenantId: string, userId: string, addressId: string): Promise<boolean>;
  unsetDefault(tenantId: string, userId: string): Promise<void>;
  promoteMostRecent(tenantId: string, userId: string, now: Date): Promise<void>;
}
