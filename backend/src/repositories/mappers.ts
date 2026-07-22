import { products, users } from '@/database/schema';
import type { ProductStatus } from '@/productStatus';
import type { ProductRecord } from '@/repositories/productRepository';
import type { PublicUser } from '@/repositories/userRepository';
import { resolveTenant } from '@/tenants';

type UserRow = typeof users.$inferSelect;
type ProductRow = typeof products.$inferSelect;

export function mapUserRow(row: UserRow): PublicUser {
  return {
    _id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    emailVerifiedAt: row.emailVerifiedAt,
    username: row.username,
    telephone: row.telephone,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapProductRow(row: ProductRow): ProductRecord {
  const tenant = resolveTenant(row.tenantId);
  if (!tenant) throw new Error(`Unknown product tenant: ${row.tenantId}`);
  return {
    _id: row.id,
    tenantId: row.tenantId,
    seller: row.sellerId,
    name: row.name,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    inventory: row.inventory,
    price:
      row.unitPriceMinor === null
        ? null
        : {
            currency: tenant.currencyCode,
            amountMinor: row.unitPriceMinor.toString(),
          },
    image: row.imageUrl,
    status: row.status as ProductStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
