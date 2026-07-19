CREATE TABLE "account_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" varchar(32) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"token_hash_secret_version" varchar(32) NOT NULL,
	"email_version" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"invalidation_reason" varchar(32),
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "account_tokens_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "account_tokens_purpose_check" CHECK ("account_tokens"."purpose" in ('email_verification', 'password_reset')),
	CONSTRAINT "account_tokens_email_version_check" CHECK (("account_tokens"."purpose" = 'email_verification' and "account_tokens"."email_version" is not null and "account_tokens"."email_version" >= 0)
        or ("account_tokens"."purpose" = 'password_reset' and "account_tokens"."email_version" is null)),
	CONSTRAINT "account_tokens_expiry_check" CHECK ("account_tokens"."expires_at" > "account_tokens"."created_at"),
	CONSTRAINT "account_tokens_lifecycle_check" CHECK (not ("account_tokens"."consumed_at" is not null and "account_tokens"."invalidated_at" is not null)
        and ("account_tokens"."invalidated_at" is null) = ("account_tokens"."invalidation_reason" is null)
        and ("account_tokens"."consumed_at" is null or "account_tokens"."consumed_at" >= "account_tokens"."created_at")
        and ("account_tokens"."invalidated_at" is null or "account_tokens"."invalidated_at" >= "account_tokens"."created_at")),
	CONSTRAINT "account_tokens_invalidation_reason_check" CHECK ("account_tokens"."invalidation_reason" is null or "account_tokens"."invalidation_reason" in ('replaced', 'password_reset', 'email_changed'))
);
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_event_type_check";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_tenant_user_fkey" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "account_tokens_active_key" ON "account_tokens" USING btree ("tenant_id","user_id","purpose") WHERE "account_tokens"."consumed_at" is null and "account_tokens"."invalidated_at" is null;--> statement-breakpoint
CREATE INDEX "account_tokens_issuance_idx" ON "account_tokens" USING btree ("tenant_id","user_id","purpose","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "account_tokens_expiry_idx" ON "account_tokens" USING btree ("expires_at","id");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_event_type_check" CHECK ("audit_events"."event_type" in ('session.created', 'session.rotated', 'session.revoked', 'session.reuse_detected', 'inventory.set', 'inventory.decremented', 'order.placed', 'order.status_changed', 'user.email_verified', 'user.password_reset'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_version_check" CHECK ("users"."email_version" >= 0);
