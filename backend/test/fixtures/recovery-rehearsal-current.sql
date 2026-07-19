INSERT INTO pending_email_changes (
  id, tenant_id, user_id, email, email_version, expires_at, created_at
) VALUES (
  'c0000000-0000-4000-8000-000000000001', 'mercadozetta',
  '10000000-0000-4000-8000-000000000001',
  'rehearsal-new-address@example.invalid', 0,
  '2026-07-19T12:30:00Z', '2026-07-19T12:00:00Z'
);

UPDATE users
SET deactivated_at = '2026-07-19T12:00:00Z',
    username = NULL,
    telephone = NULL,
    updated_at = '2026-07-19T12:00:00Z'
WHERE tenant_id = 'mercadozetta'
  AND id = '10000000-0000-4000-8000-000000000002';

INSERT INTO audit_events (
  id, tenant_id, event_type, actor_id, resource_type, resource_id, metadata,
  occurred_at
) VALUES (
  'b0000000-0000-4000-8000-000000000003', 'mercadozetta',
  'user.deactivated', '10000000-0000-4000-8000-000000000002', 'user',
  '10000000-0000-4000-8000-000000000002', '{"archivedListingCount":1}',
  '2026-07-19T12:00:00Z'
);
