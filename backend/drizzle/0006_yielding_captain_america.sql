CREATE TABLE "mutation_idempotency" (
	"tenant_id" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"operation" varchar(64) NOT NULL,
	"key" uuid NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"resource_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "mutation_idempotency_pkey" PRIMARY KEY("tenant_id","actor_id","operation","key"),
	CONSTRAINT "mutation_idempotency_operation_check" CHECK ("mutation_idempotency"."operation" in ('product.create', 'review.upsert')),
	CONSTRAINT "mutation_idempotency_request_hash_check" CHECK (length("mutation_idempotency"."request_hash") = 64)
);
--> statement-breakpoint
ALTER TABLE "mutation_idempotency" ADD CONSTRAINT "mutation_idempotency_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "mutation_idempotency_resource_idx" ON "mutation_idempotency" USING btree ("tenant_id","operation","resource_id");