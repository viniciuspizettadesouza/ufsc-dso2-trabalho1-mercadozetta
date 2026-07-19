UPDATE products
SET unit_price_minor = 1250,
    updated_at = '2026-07-19T11:00:00Z'
WHERE tenant_id = 'mercadozetta'
  AND id = '67000000-0000-4000-8000-000000000001';

INSERT INTO product_price_history (
  tenant_id, product_id, sequence, currency_code, currency_minor_unit,
  unit_price_minor, actor_id, changed_at
) VALUES (
  'mercadozetta', '67000000-0000-4000-8000-000000000001', 1, 'USD', 2,
  1250, '10000000-0000-4000-8000-000000000002', '2026-07-19T11:00:00Z'
);

INSERT INTO users (
  id, tenant_id, email, password_hash, token_version, email_verified_at,
  email_version, username, telephone, created_at, updated_at
) VALUES
  ('11000000-0000-4000-8000-000000000001', 'campus-market',
   'campus-rehearsal-buyer@example.invalid', 'synthetic-campus-buyer-hash', 0,
   '2026-07-19T11:00:00Z', 0, 'campus rehearsal buyer', NULL,
   '2026-07-19T11:00:00Z', '2026-07-19T11:00:00Z'),
  ('11000000-0000-4000-8000-000000000002', 'campus-market',
   'campus-rehearsal-seller@example.invalid', 'synthetic-campus-seller-hash', 0,
   '2026-07-19T11:00:00Z', 0, 'campus rehearsal seller', NULL,
   '2026-07-19T11:00:00Z', '2026-07-19T11:00:00Z');

INSERT INTO products (
  id, tenant_id, seller_id, name, description, category, subcategory,
  inventory, unit_price_minor, image_url, status, created_at, updated_at
) VALUES (
  '67000000-0000-4000-8000-000000000003', 'campus-market',
  '11000000-0000-4000-8000-000000000002', 'campus rehearsal product',
  'synthetic CampusMarket EUR transition fixture', 'study', 'supplies',
  4, 1999, '/campus-rehearsal.png', 'active',
  '2026-07-19T11:00:00Z', '2026-07-19T11:00:00Z'
);

INSERT INTO product_price_history (
  tenant_id, product_id, sequence, currency_code, currency_minor_unit,
  unit_price_minor, actor_id, changed_at
) VALUES (
  'campus-market', '67000000-0000-4000-8000-000000000003', 1, 'USD', 2,
  1999, '11000000-0000-4000-8000-000000000002', '2026-07-19T11:00:00Z'
);

INSERT INTO orders (
  id, tenant_id, buyer_id, checkout_idempotency_key, pricing_state,
  currency_code, currency_minor_unit, subtotal_minor, discount_minor,
  shipping_minor, total_minor, status, created_at, updated_at
) VALUES (
  '51000000-0000-4000-8000-000000000001', 'campus-market',
  '11000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001', 'priced', 'USD', 2,
  1999, 0, 0, 1999, 'delivered',
  '2026-07-19T11:00:00Z', '2026-07-19T11:00:00Z'
);

INSERT INTO order_items (
  id, tenant_id, order_id, product_id, seller_id, product_name, quantity,
  pricing_state, unit_price_minor, line_subtotal_minor, created_at, updated_at
) VALUES (
  '61000000-0000-4000-8000-000000000001', 'campus-market',
  '51000000-0000-4000-8000-000000000001',
  '67000000-0000-4000-8000-000000000003',
  '11000000-0000-4000-8000-000000000002', 'campus rehearsal USD product', 1,
  'priced', 1999, 1999,
  '2026-07-19T11:00:00Z', '2026-07-19T11:00:00Z'
);
