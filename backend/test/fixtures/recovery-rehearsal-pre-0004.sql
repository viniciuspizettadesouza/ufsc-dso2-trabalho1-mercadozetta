INSERT INTO users (
  id, tenant_id, email, password_hash, token_version, email_verified_at,
  email_version, username, telephone, created_at, updated_at
) VALUES
  ('10000000-0000-4000-8000-000000000001', 'mercadozetta',
   'rehearsal-buyer@example.invalid', 'synthetic-buyer-hash', 0,
   '2026-07-01T00:00:00Z', 0, 'rehearsal buyer', NULL,
   '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000002', 'mercadozetta',
   'rehearsal-seller@example.invalid', 'synthetic-seller-hash', 0,
   '2026-07-01T00:00:00Z', 0, 'rehearsal seller', NULL,
   '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z');

INSERT INTO products (
  id, tenant_id, seller_id, name, description, category, subcategory,
  inventory, image_url, status, created_at, updated_at
) VALUES (
  '20000000-0000-4000-8000-000000000001', 'mercadozetta',
  '10000000-0000-4000-8000-000000000002', 'rehearsal product',
  'synthetic recovery fixture', 'general', '', 9, '/rehearsal.png', 'active',
  '2026-07-02T00:00:00Z', '2026-07-02T00:00:00Z'
);

INSERT INTO carts (id, tenant_id, buyer_id, created_at, updated_at) VALUES (
  '30000000-0000-4000-8000-000000000001', 'mercadozetta',
  '10000000-0000-4000-8000-000000000001',
  '2026-07-03T00:00:00Z', '2026-07-03T00:00:00Z'
);

INSERT INTO cart_items (tenant_id, cart_id, product_id, quantity) VALUES (
  'mercadozetta', '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', 2
);

INSERT INTO watchlist_entries (
  id, tenant_id, user_id, product_id, created_at, updated_at
) VALUES (
  '40000000-0000-4000-8000-000000000001', 'mercadozetta',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '2026-07-03T00:00:00Z', '2026-07-03T00:00:00Z'
);

INSERT INTO orders (id, tenant_id, buyer_id, status, created_at, updated_at)
VALUES (
  '50000000-0000-4000-8000-000000000001', 'mercadozetta',
  '10000000-0000-4000-8000-000000000001', 'confirmed',
  '2026-07-04T00:00:00Z', '2026-07-04T01:00:00Z'
);

INSERT INTO order_items (
  id, tenant_id, order_id, product_id, seller_id, product_name, quantity,
  created_at, updated_at
) VALUES (
  '60000000-0000-4000-8000-000000000001', 'mercadozetta',
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002', 'rehearsal product', 1,
  '2026-07-04T00:00:00Z', '2026-07-04T00:00:00Z'
);

INSERT INTO order_status_history (
  tenant_id, order_id, sequence, status, actor_id, changed_at
) VALUES
  ('mercadozetta', '50000000-0000-4000-8000-000000000001', 1, 'placed',
   '10000000-0000-4000-8000-000000000001', '2026-07-04T00:00:00Z'),
  ('mercadozetta', '50000000-0000-4000-8000-000000000001', 2, 'confirmed',
   '10000000-0000-4000-8000-000000000002', '2026-07-04T01:00:00Z');

INSERT INTO reviews (
  id, tenant_id, product_id, author_id, rating, comment, created_at, updated_at
) VALUES (
  '70000000-0000-4000-8000-000000000001', 'mercadozetta',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 5, 'synthetic review',
  '2026-07-05T00:00:00Z', '2026-07-05T00:00:00Z'
);

INSERT INTO notifications (
  id, tenant_id, user_id, message, is_read, created_at, updated_at
) VALUES
  ('80000000-0000-4000-8000-000000000001', 'mercadozetta',
   '10000000-0000-4000-8000-000000000001', 'Synthetic order update', false,
   '2026-07-05T00:00:00Z', '2026-07-05T00:00:00Z'),
  ('80000000-0000-4000-8000-000000000002', 'mercadozetta',
   '10000000-0000-4000-8000-000000000002', 'Synthetic review update', true,
   '2026-07-05T00:00:00Z', '2026-07-05T01:00:00Z');

INSERT INTO sessions (
  id, tenant_id, user_id, family_id, token_version, refresh_token_hash,
  refresh_token_secret_version, rotation_counter, last_used_at,
  absolute_expires_at, expires_at, user_agent_label, created_at, updated_at
) VALUES (
  '90000000-0000-4000-8000-000000000001', 'mercadozetta',
  '10000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000002', 0, 'synthetic-refresh-hash',
  'current', 0, '2026-07-06T00:00:00Z', '2026-08-05T00:00:00Z',
  '2026-07-13T00:00:00Z', 'rehearsal browser',
  '2026-07-06T00:00:00Z', '2026-07-06T00:00:00Z'
);

INSERT INTO account_tokens (
  id, tenant_id, user_id, purpose, token_hash, token_hash_secret_version,
  email_version, expires_at, consumed_at, invalidated_at,
  invalidation_reason, created_at
) VALUES (
  'a0000000-0000-4000-8000-000000000001', 'mercadozetta',
  '10000000-0000-4000-8000-000000000001', 'password_reset',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'current', NULL, '2026-07-06T00:30:00Z', '2026-07-06T00:10:00Z',
  NULL, NULL, '2026-07-06T00:00:00Z'
);

INSERT INTO audit_events (
  id, tenant_id, event_type, actor_id, resource_type, resource_id, metadata,
  occurred_at
) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'mercadozetta',
   'session.created', '10000000-0000-4000-8000-000000000001', 'session',
   '90000000-0000-4000-8000-000000000001', '{"fixture":true}',
   '2026-07-06T00:00:00Z'),
  ('b0000000-0000-4000-8000-000000000002', 'mercadozetta',
   'order.placed', '10000000-0000-4000-8000-000000000001', 'order',
   '50000000-0000-4000-8000-000000000001', '{"itemCount":1}',
   '2026-07-04T00:00:00Z');
