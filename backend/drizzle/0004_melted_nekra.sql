CREATE TABLE "pending_email_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"email_version" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pending_email_changes_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "pending_email_changes_tenant_user_key" UNIQUE("tenant_id","user_id"),
	CONSTRAINT "pending_email_changes_email_version_check" CHECK ("pending_email_changes"."email_version" >= 0),
	CONSTRAINT "pending_email_changes_expiry_check" CHECK ("pending_email_changes"."expires_at" > "pending_email_changes"."created_at")
);
--> statement-breakpoint
ALTER TABLE "account_tokens" DROP CONSTRAINT "account_tokens_purpose_check";--> statement-breakpoint
ALTER TABLE "account_tokens" DROP CONSTRAINT "account_tokens_email_version_check";--> statement-breakpoint
ALTER TABLE "account_tokens" DROP CONSTRAINT "account_tokens_invalidation_reason_check";--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_event_type_check";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pending_email_changes" ADD CONSTRAINT "pending_email_changes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "pending_email_changes" ADD CONSTRAINT "pending_email_changes_tenant_user_fkey" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_email_changes_tenant_email_key" ON "pending_email_changes" USING btree ("tenant_id",lower("email"));--> statement-breakpoint
CREATE INDEX "pending_email_changes_expiry_idx" ON "pending_email_changes" USING btree ("expires_at","id");--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_purpose_check" CHECK ("account_tokens"."purpose" in ('email_verification', 'password_reset', 'email_change'));--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_email_version_check" CHECK (("account_tokens"."purpose" in ('email_verification', 'email_change') and "account_tokens"."email_version" is not null and "account_tokens"."email_version" >= 0)
        or ("account_tokens"."purpose" = 'password_reset' and "account_tokens"."email_version" is null));--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_invalidation_reason_check" CHECK ("account_tokens"."invalidation_reason" is null or "account_tokens"."invalidation_reason" in ('replaced', 'password_reset', 'password_change', 'email_changed', 'account_deactivated'));--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_event_type_check" CHECK ("audit_events"."event_type" in ('session.created', 'session.rotated', 'session.revoked', 'session.reuse_detected', 'inventory.set', 'inventory.decremented', 'order.placed', 'order.status_changed', 'user.email_verified', 'user.password_reset', 'user.profile_updated', 'user.password_changed', 'user.email_change_requested', 'user.email_changed', 'user.deactivated'));