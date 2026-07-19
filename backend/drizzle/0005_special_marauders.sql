ALTER TABLE "orders" ADD COLUMN "checkout_idempotency_key" uuid;--> statement-breakpoint
UPDATE "orders" SET "checkout_idempotency_key" = gen_random_uuid() WHERE "checkout_idempotency_key" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "checkout_idempotency_key" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "checkout_idempotency_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_idempotency_key" UNIQUE("tenant_id","buyer_id","checkout_idempotency_key");
