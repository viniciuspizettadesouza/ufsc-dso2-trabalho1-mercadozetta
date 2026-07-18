CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"actor_id" uuid,
	"resource_type" varchar(32) NOT NULL,
	"resource_id" uuid NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "audit_events_event_type_check" CHECK ("audit_events"."event_type" in ('session.created', 'session.rotated', 'session.revoked', 'session.reuse_detected', 'inventory.set', 'inventory.decremented', 'order.placed', 'order.status_changed')),
	CONSTRAINT "audit_events_resource_type_check" CHECK ("audit_events"."resource_type" in ('session', 'user', 'product', 'order'))
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "audit_events_tenant_time_idx" ON "audit_events" USING btree ("tenant_id","occurred_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_resource_idx" ON "audit_events" USING btree ("tenant_id","resource_type","resource_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("tenant_id","actor_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE FUNCTION reject_audit_event_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'audit events are append-only' USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER audit_events_reject_update
BEFORE UPDATE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();--> statement-breakpoint
CREATE TRIGGER audit_events_reject_delete
BEFORE DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();
