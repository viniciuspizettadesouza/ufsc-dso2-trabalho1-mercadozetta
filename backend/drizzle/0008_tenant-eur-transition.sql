CREATE TABLE "tenant_currencies" (
	"tenant_id" text NOT NULL,
	"currency_code" char(3) NOT NULL,
	"currency_minor_unit" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_currencies_pkey" PRIMARY KEY("tenant_id","currency_code","currency_minor_unit"),
	CONSTRAINT "tenant_currencies_currency_code_check" CHECK ("tenant_currencies"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "tenant_currencies_minor_unit_check" CHECK ("tenant_currencies"."currency_minor_unit" between 0 and 4)
);
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_tenant_currency_fkey";
--> statement-breakpoint
ALTER TABLE "product_price_history" DROP CONSTRAINT "product_price_history_tenant_currency_fkey";
--> statement-breakpoint
ALTER TABLE "tenant_currencies" ADD CONSTRAINT "tenant_currencies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
INSERT INTO "tenant_currencies" (
	"tenant_id",
	"currency_code",
	"currency_minor_unit"
)
SELECT "id", "currency_code", "currency_minor_unit"
FROM "tenants"
ON CONFLICT ("tenant_id", "currency_code", "currency_minor_unit") DO NOTHING;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_currency_fkey" FOREIGN KEY ("tenant_id","currency_code","currency_minor_unit") REFERENCES "public"."tenant_currencies"("tenant_id","currency_code","currency_minor_unit") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_tenant_currency_fkey" FOREIGN KEY ("tenant_id","currency_code","currency_minor_unit") REFERENCES "public"."tenant_currencies"("tenant_id","currency_code","currency_minor_unit") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
INSERT INTO "tenant_currencies" (
	"tenant_id",
	"currency_code",
	"currency_minor_unit"
)
VALUES
	('campus-market', 'EUR', 2)
ON CONFLICT ("tenant_id", "currency_code", "currency_minor_unit") DO NOTHING;--> statement-breakpoint
UPDATE "products"
SET
	"unit_price_minor" = NULL,
	"status" = CASE
		WHEN "status" IN ('active', 'sold_out') THEN 'paused'
		ELSE "status"
	END,
	"updated_at" = now()
WHERE "tenant_id" = 'campus-market'
	AND "id" NOT IN (
		'67000000-0000-4000-8000-000000000001',
		'67000000-0000-4000-8000-000000000002',
		'67000000-0000-4000-8000-000000000003',
		'67000000-0000-4000-8000-000000000004'
	);--> statement-breakpoint
WITH "eur_prices" ("tenant_id", "product_id", "unit_price_minor") AS (
	VALUES
		('campus-market', '67000000-0000-4000-8000-000000000003'::uuid, 1899::bigint),
		('campus-market', '67000000-0000-4000-8000-000000000004'::uuid, 5490::bigint)
)
INSERT INTO "product_price_history" (
	"tenant_id",
	"product_id",
	"sequence",
	"currency_code",
	"currency_minor_unit",
	"unit_price_minor",
	"actor_id",
	"changed_at"
)
SELECT
	"eur_prices"."tenant_id",
	"eur_prices"."product_id",
	COALESCE((
		SELECT max("history"."sequence")
		FROM "product_price_history" AS "history"
		WHERE "history"."tenant_id" = "eur_prices"."tenant_id"
			AND "history"."product_id" = "eur_prices"."product_id"
	), 0) + 1,
	'EUR',
	2,
	"eur_prices"."unit_price_minor",
	"products"."seller_id",
	now()
FROM "eur_prices"
INNER JOIN "products"
	ON "products"."tenant_id" = "eur_prices"."tenant_id"
	AND "products"."id" = "eur_prices"."product_id";--> statement-breakpoint
WITH "eur_prices" ("tenant_id", "product_id", "unit_price_minor") AS (
	VALUES
		('campus-market', '67000000-0000-4000-8000-000000000003'::uuid, 1899::bigint),
		('campus-market', '67000000-0000-4000-8000-000000000004'::uuid, 5490::bigint)
)
UPDATE "products"
SET
	"unit_price_minor" = "eur_prices"."unit_price_minor",
	"status" = 'active',
	"updated_at" = now()
FROM "eur_prices"
WHERE "products"."tenant_id" = "eur_prices"."tenant_id"
	AND "products"."id" = "eur_prices"."product_id";--> statement-breakpoint
UPDATE "tenants"
SET
	"currency_code" = 'EUR',
	"currency_minor_unit" = 2
WHERE "id" = 'campus-market';
