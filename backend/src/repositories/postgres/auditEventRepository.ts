import { randomUUID } from 'node:crypto';
import type { Database } from '@/database/postgres';
import { auditEvents } from '@/database/schema';
import type {
  AppendAuditEvent,
  AuditEventRepository,
} from '@/repositories/auditEventRepository';

type TransactionDatabase = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

export class PostgresAuditEventRepository implements AuditEventRepository {
  constructor(private readonly db: Database | TransactionDatabase) {}

  async append(event: AppendAuditEvent) {
    await this.appendMany([event]);
  }

  async appendMany(events: AppendAuditEvent[]) {
    if (!events.length) return;
    await this.db.insert(auditEvents).values(
      events.map((event) => ({
        id: randomUUID(),
        tenantId: event.tenantId,
        eventType: event.eventType,
        actorId: event.actorId,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        metadata: event.metadata,
        occurredAt: event.occurredAt,
      })),
    );
  }
}
