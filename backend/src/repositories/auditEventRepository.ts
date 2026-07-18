export type AuditEventType =
  | 'session.created'
  | 'session.rotated'
  | 'session.revoked'
  | 'session.reuse_detected'
  | 'inventory.set'
  | 'inventory.decremented'
  | 'order.placed'
  | 'order.status_changed';

export type AuditResourceType = 'session' | 'user' | 'product' | 'order';

export type AuditMetadata = Record<string, string | number | boolean | null>;

export type AppendAuditEvent = {
  tenantId: string;
  eventType: AuditEventType;
  actorId?: string;
  resourceType: AuditResourceType;
  resourceId: string;
  metadata?: AuditMetadata;
  occurredAt: Date;
};

export interface AuditEventRepository {
  append(event: AppendAuditEvent): Promise<void>;
  appendMany(events: AppendAuditEvent[]): Promise<void>;
}
