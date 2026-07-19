CREATE TABLE "product_price_history" (
	"tenant_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"currency_code" char(3) NOT NULL,
	"currency_minor_unit" smallint NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"actor_id" uuid NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "product_price_history_pkey" PRIMARY KEY("tenant_id","product_id","sequence"),
	CONSTRAINT "product_price_history_sequence_check" CHECK ("product_price_history"."sequence" > 0),
	CONSTRAINT "product_price_history_unit_price_minor_check" CHECK ("product_price_history"."unit_price_minor" between 0 and 9000000000000000)
);
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_tenant_order_fkey";
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "pricing_state" varchar(24) DEFAULT 'legacy_unpriced' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_price_minor" bigint;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "line_subtotal_minor" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pricing_state" varchar(24) DEFAULT 'legacy_unpriced' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "currency_code" char(3);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "currency_minor_unit" smallint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal_minor" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_minor" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_minor" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "total_minor" bigint;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "unit_price_minor" bigint;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "currency_code" char(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "currency_minor_unit" smallint DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_pricing_state_key" UNIQUE("tenant_id","id","pricing_state");--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_id_currency_key" UNIQUE("id","currency_code","currency_minor_unit");--> statement-breakpoint
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_tenant_product_fkey" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."products"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_tenant_currency_fkey" FOREIGN KEY ("tenant_id","currency_code","currency_minor_unit") REFERENCES "public"."tenants"("id","currency_code","currency_minor_unit") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "product_price_history_changed_idx" ON "product_price_history" USING btree ("tenant_id","product_id","changed_at" DESC NULLS LAST,"sequence" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_order_fkey" FOREIGN KEY ("tenant_id","order_id","pricing_state") REFERENCES "public"."orders"("tenant_id","id","pricing_state") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_currency_fkey" FOREIGN KEY ("tenant_id","currency_code","currency_minor_unit") REFERENCES "public"."tenants"("id","currency_code","currency_minor_unit") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_monetary_shape_check" CHECK (("order_items"."pricing_state" = 'legacy_unpriced'
        and "order_items"."unit_price_minor" is null
        and "order_items"."line_subtotal_minor" is null)
        or ("order_items"."pricing_state" = 'priced'
          and "order_items"."unit_price_minor" between 0 and 9000000000000000
          and "order_items"."line_subtotal_minor" between 0 and 9000000000000000
          and "order_items"."line_subtotal_minor" = "order_items"."unit_price_minor" * "order_items"."quantity"));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pricing_state_check" CHECK ("orders"."pricing_state" in ('legacy_unpriced', 'priced'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_monetary_shape_check" CHECK (("orders"."pricing_state" = 'legacy_unpriced'
        and "orders"."currency_code" is null
        and "orders"."currency_minor_unit" is null
        and "orders"."subtotal_minor" is null
        and "orders"."discount_minor" is null
        and "orders"."shipping_minor" is null
        and "orders"."total_minor" is null)
        or ("orders"."pricing_state" = 'priced'
          and "orders"."currency_code" is not null
          and "orders"."currency_minor_unit" is not null
          and "orders"."subtotal_minor" is not null
          and "orders"."discount_minor" is not null
          and "orders"."shipping_minor" is not null
          and "orders"."total_minor" is not null));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_monetary_amounts_check" CHECK ("orders"."pricing_state" = 'legacy_unpriced' or (
        "orders"."subtotal_minor" between 0 and 9000000000000000
        and "orders"."discount_minor" between 0 and "orders"."subtotal_minor"
        and "orders"."shipping_minor" between 0 and 9000000000000000
        and "orders"."total_minor" between 0 and 9000000000000000
        and "orders"."total_minor" = "orders"."subtotal_minor" - "orders"."discount_minor" + "orders"."shipping_minor"
      ));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_unit_price_minor_check" CHECK ("products"."unit_price_minor" is null or ("products"."unit_price_minor" >= 0 and "products"."unit_price_minor" <= 9000000000000000));--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_currency_code_check" CHECK ("tenants"."currency_code" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_currency_minor_unit_check" CHECK ("tenants"."currency_minor_unit" between 0 and 4);--> statement-breakpoint

CREATE FUNCTION product_price_history_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'product price history is append-only';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER product_price_history_reject_update
BEFORE UPDATE ON "product_price_history"
FOR EACH ROW EXECUTE FUNCTION product_price_history_reject_mutation();--> statement-breakpoint
CREATE TRIGGER product_price_history_reject_delete
BEFORE DELETE ON "product_price_history"
FOR EACH ROW EXECUTE FUNCTION product_price_history_reject_mutation();--> statement-breakpoint

CREATE FUNCTION orders_reject_monetary_snapshot_update() RETURNS trigger AS $$
BEGIN
  IF OLD.pricing_state IS DISTINCT FROM NEW.pricing_state
    OR OLD.currency_code IS DISTINCT FROM NEW.currency_code
    OR OLD.currency_minor_unit IS DISTINCT FROM NEW.currency_minor_unit
    OR OLD.subtotal_minor IS DISTINCT FROM NEW.subtotal_minor
    OR OLD.discount_minor IS DISTINCT FROM NEW.discount_minor
    OR OLD.shipping_minor IS DISTINCT FROM NEW.shipping_minor
    OR OLD.total_minor IS DISTINCT FROM NEW.total_minor THEN
    RAISE EXCEPTION 'order monetary snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER orders_reject_monetary_snapshot_update
BEFORE UPDATE ON "orders"
FOR EACH ROW EXECUTE FUNCTION orders_reject_monetary_snapshot_update();--> statement-breakpoint

CREATE FUNCTION order_items_reject_snapshot_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'order item snapshot is immutable';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER order_items_reject_snapshot_update
BEFORE UPDATE ON "order_items"
FOR EACH ROW EXECUTE FUNCTION order_items_reject_snapshot_update();--> statement-breakpoint
CREATE TRIGGER order_items_reject_snapshot_delete
BEFORE DELETE ON "order_items"
FOR EACH ROW EXECUTE FUNCTION order_items_reject_snapshot_update();
