import { describe, expect, it } from 'vitest';
import { mapProductRow, mapUserRow } from '@/repositories/mappers';

describe('PostgreSQL repository mappers', () => {
  it('maps relational names to database-neutral API records', () => {
    const now = new Date('2026-07-16T12:00:00.000Z');

    expect(
      mapUserRow({
        id: '507f1f77-bcf8-4ecd-8994-390110000001',
        tenantId: 'mercadozetta',
        email: 'seller@example.com',
        passwordHash: 'not-exposed',
        tokenVersion: 2,
        emailVerifiedAt: null,
        emailVersion: 0,
        deactivatedAt: null,
        username: 'seller',
        telephone: '123',
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual({
      _id: '507f1f77-bcf8-4ecd-8994-390110000001',
      tenantId: 'mercadozetta',
      email: 'seller@example.com',
      username: 'seller',
      telephone: '123',
      createdAt: now,
      updatedAt: now,
    });

    expect(
      mapProductRow({
        id: '607f1f77-bcf8-4ecd-8994-390120000002',
        tenantId: 'mercadozetta',
        sellerId: '507f1f77-bcf8-4ecd-8994-390110000001',
        name: 'keyboard',
        description: null,
        category: 'peripherals',
        subcategory: 'keyboards',
        inventory: 2,
        imageUrl: 'keyboard.png',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual({
      _id: '607f1f77-bcf8-4ecd-8994-390120000002',
      tenantId: 'mercadozetta',
      seller: '507f1f77-bcf8-4ecd-8994-390110000001',
      name: 'keyboard',
      description: null,
      category: 'peripherals',
      subcategory: 'keyboards',
      inventory: 2,
      image: 'keyboard.png',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  });
});
