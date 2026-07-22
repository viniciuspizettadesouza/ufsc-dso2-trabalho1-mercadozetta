CREATE TABLE "delivery_addresses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(80) NOT NULL,
	"recipient_name" varchar(160) NOT NULL,
	"line1" varchar(200) NOT NULL,
	"line2" varchar(200),
	"city" varchar(120) NOT NULL,
	"region" varchar(120),
	"postal_code" varchar(20) NOT NULL,
	"country_code" char(2) NOT NULL,
	"telephone" varchar(40) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "delivery_addresses_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "delivery_addresses_country_code_check" CHECK ("delivery_addresses"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_address" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_option" jsonb;--> statement-breakpoint
ALTER TABLE "delivery_addresses" ADD CONSTRAINT "delivery_addresses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "delivery_addresses" ADD CONSTRAINT "delivery_addresses_tenant_user_fkey" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_addresses_default_key" ON "delivery_addresses" USING btree ("tenant_id","user_id") WHERE "delivery_addresses"."is_default" = true;--> statement-breakpoint
CREATE INDEX "delivery_addresses_user_idx" ON "delivery_addresses" USING btree ("tenant_id","user_id","is_default" DESC NULLS LAST,"updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);