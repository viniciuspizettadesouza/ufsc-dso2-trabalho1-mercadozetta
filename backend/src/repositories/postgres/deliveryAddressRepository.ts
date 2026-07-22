import { randomUUID } from 'node:crypto';
import { and, count, desc, eq } from 'drizzle-orm';

import type { Database } from '@/database/postgres';
import { deliveryAddresses } from '@/database/schema';
import type {
  DeliveryAddressFields,
  DeliveryAddressRepository,
} from '@/repositories/deliveryAddressRepository';

type TransactionDatabase = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

const mapAddress = (row: typeof deliveryAddresses.$inferSelect) => ({
  _id: row.id,
  tenantId: row.tenantId,
  userId: row.userId,
  label: row.label,
  recipientName: row.recipientName,
  line1: row.line1,
  line2: row.line2,
  city: row.city,
  region: row.region,
  postalCode: row.postalCode,
  countryCode: row.countryCode,
  telephone: row.telephone,
  isDefault: row.isDefault,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class PostgresDeliveryAddressRepository implements DeliveryAddressRepository {
  constructor(private readonly db: Database | TransactionDatabase) {}

  async list(tenantId: string, userId: string) {
    const rows = await this.db
      .select()
      .from(deliveryAddresses)
      .where(
        and(
          eq(deliveryAddresses.tenantId, tenantId),
          eq(deliveryAddresses.userId, userId),
        ),
      )
      .orderBy(
        desc(deliveryAddresses.isDefault),
        desc(deliveryAddresses.updatedAt),
        desc(deliveryAddresses.id),
      );
    return rows.map(mapAddress);
  }

  async count(tenantId: string, userId: string) {
    const [row] = await this.db
      .select({ value: count() })
      .from(deliveryAddresses)
      .where(
        and(
          eq(deliveryAddresses.tenantId, tenantId),
          eq(deliveryAddresses.userId, userId),
        ),
      );
    return Number(row?.value ?? 0);
  }

  async findById(tenantId: string, userId: string, addressId: string) {
    const [row] = await this.db
      .select()
      .from(deliveryAddresses)
      .where(
        and(
          eq(deliveryAddresses.tenantId, tenantId),
          eq(deliveryAddresses.userId, userId),
          eq(deliveryAddresses.id, addressId),
        ),
      )
      .limit(1);
    return row ? mapAddress(row) : null;
  }

  async findByIdForUpdate(tenantId: string, userId: string, addressId: string) {
    const [row] = await this.db
      .select()
      .from(deliveryAddresses)
      .where(
        and(
          eq(deliveryAddresses.tenantId, tenantId),
          eq(deliveryAddresses.userId, userId),
          eq(deliveryAddresses.id, addressId),
        ),
      )
      .limit(1)
      .for('update');
    return row ? mapAddress(row) : null;
  }

  async create(
    tenantId: string,
    userId: string,
    fields: DeliveryAddressFields,
    now: Date,
  ) {
    const [row] = await this.db
      .insert(deliveryAddresses)
      .values({
        id: randomUUID(),
        tenantId,
        userId,
        ...fields,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return mapAddress(row);
  }

  async update(
    tenantId: string,
    userId: string,
    addressId: string,
    fields: DeliveryAddressFields,
    now: Date,
  ) {
    const [row] = await this.db
      .update(deliveryAddresses)
      .set({ ...fields, updatedAt: now })
      .where(
        and(
          eq(deliveryAddresses.tenantId, tenantId),
          eq(deliveryAddresses.userId, userId),
          eq(deliveryAddresses.id, addressId),
        ),
      )
      .returning();
    return row ? mapAddress(row) : null;
  }

  async delete(tenantId: string, userId: string, addressId: string) {
    const rows = await this.db
      .delete(deliveryAddresses)
      .where(
        and(
          eq(deliveryAddresses.tenantId, tenantId),
          eq(deliveryAddresses.userId, userId),
          eq(deliveryAddresses.id, addressId),
        ),
      )
      .returning({ id: deliveryAddresses.id });
    return rows.length === 1;
  }

  async unsetDefault(tenantId: string, userId: string) {
    await this.db
      .update(deliveryAddresses)
      .set({ isDefault: false })
      .where(
        and(
          eq(deliveryAddresses.tenantId, tenantId),
          eq(deliveryAddresses.userId, userId),
          eq(deliveryAddresses.isDefault, true),
        ),
      );
  }

  async promoteMostRecent(tenantId: string, userId: string, now: Date) {
    const [replacement] = await this.db
      .select({ id: deliveryAddresses.id })
      .from(deliveryAddresses)
      .where(
        and(
          eq(deliveryAddresses.tenantId, tenantId),
          eq(deliveryAddresses.userId, userId),
        ),
      )
      .orderBy(desc(deliveryAddresses.updatedAt), desc(deliveryAddresses.id))
      .limit(1);
    if (!replacement) return;
    await this.db
      .update(deliveryAddresses)
      .set({ isDefault: true, updatedAt: now })
      .where(
        and(
          eq(deliveryAddresses.tenantId, tenantId),
          eq(deliveryAddresses.userId, userId),
          eq(deliveryAddresses.id, replacement.id),
        ),
      );
  }
}
