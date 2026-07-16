CREATE TABLE "cart_items" (
	"tenant_id" text NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "cart_items_pkey" PRIMARY KEY("tenant_id","cart_id","product_id"),
	CONSTRAINT "cart_items_quantity_check" CHECK ("cart_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"buyer_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "carts_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "carts_tenant_buyer_key" UNIQUE("tenant_id","buyer_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notifications_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "order_items_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "order_items_order_product_key" UNIQUE("tenant_id","order_id","product_id"),
	CONSTRAINT "order_items_quantity_check" CHECK ("order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"tenant_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"status" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "order_status_history_pkey" PRIMARY KEY("tenant_id","order_id","sequence"),
	CONSTRAINT "order_status_history_sequence_check" CHECK ("order_status_history"."sequence" > 0),
	CONSTRAINT "order_status_history_status_check" CHECK ("order_status_history"."status" in ('placed', 'confirmed', 'shipped', 'delivered', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"buyer_id" uuid NOT NULL,
	"status" text DEFAULT 'placed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "orders_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" in ('placed', 'confirmed', 'shipped', 'delivered', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"seller_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"subcategory" text DEFAULT '' NOT NULL,
	"inventory" integer NOT NULL,
	"image_url" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "products_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "products_inventory_check" CHECK ("products"."inventory" >= 0),
	CONSTRAINT "products_status_check" CHECK ("products"."status" in ('draft', 'active', 'paused', 'sold_out', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reviews_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "reviews_tenant_product_author_key" UNIQUE("tenant_id","product_id","author_id"),
	CONSTRAINT "reviews_rating_check" CHECK ("reviews"."rating" between 1 and 5),
	CONSTRAINT "reviews_comment_length_check" CHECK (length("reviews"."comment") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_version" integer NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"refresh_token_secret_version" varchar(32),
	"previous_refresh_token_hash" text,
	"previous_refresh_token_secret_version" varchar(32),
	"rotation_counter" integer DEFAULT 0 NOT NULL,
	"rotated_at" timestamp with time zone,
	"last_used_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"user_agent_label" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "sessions_tenant_family_key" UNIQUE("tenant_id","family_id"),
	CONSTRAINT "sessions_token_version_check" CHECK ("sessions"."token_version" >= 0),
	CONSTRAINT "sessions_rotation_counter_check" CHECK ("sessions"."rotation_counter" >= 0),
	CONSTRAINT "sessions_refresh_secret_version_check" CHECK ("sessions"."refresh_token_secret_version" is null
        or "sessions"."refresh_token_secret_version" ~ '^[A-Za-z0-9_-]{1,32}$'),
	CONSTRAINT "sessions_previous_secret_version_check" CHECK ("sessions"."previous_refresh_token_secret_version" is null
        or "sessions"."previous_refresh_token_secret_version" ~ '^[A-Za-z0-9_-]{1,32}$'),
	CONSTRAINT "sessions_previous_hash_version_check" CHECK (("sessions"."previous_refresh_token_hash" is null) = ("sessions"."previous_refresh_token_secret_version" is null)),
	CONSTRAINT "sessions_revocation_check" CHECK (("sessions"."revoked_at" is null) = ("sessions"."revoke_reason" is null)),
	CONSTRAINT "sessions_expiry_check" CHECK ("sessions"."expires_at" <= "sessions"."absolute_expires_at"
        and "sessions"."expires_at" > "sessions"."created_at"
        and "sessions"."absolute_expires_at" > "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"username" text,
	"telephone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "users_token_version_check" CHECK ("users"."token_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "watchlist_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "watchlist_entries_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "watchlist_entries_tenant_user_product_key" UNIQUE("tenant_id","user_id","product_id")
);
--> statement-breakpoint
-- The tenant catalog is application configuration. Seed its persistence
-- anchors in the same transaction as the initial schema.
INSERT INTO "tenants" ("id")
VALUES ('mercadozetta'), ('campus-market')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_tenant_cart_fkey" FOREIGN KEY ("tenant_id","cart_id") REFERENCES "public"."carts"("tenant_id","id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_tenant_product_fkey" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."products"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_tenant_buyer_fkey" FOREIGN KEY ("tenant_id","buyer_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_user_fkey" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_order_fkey" FOREIGN KEY ("tenant_id","order_id") REFERENCES "public"."orders"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_product_fkey" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."products"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_seller_fkey" FOREIGN KEY ("tenant_id","seller_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_tenant_order_fkey" FOREIGN KEY ("tenant_id","order_id") REFERENCES "public"."orders"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_tenant_actor_fkey" FOREIGN KEY ("tenant_id","actor_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_buyer_fkey" FOREIGN KEY ("tenant_id","buyer_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_seller_fkey" FOREIGN KEY ("tenant_id","seller_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tenant_product_fkey" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."products"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tenant_author_fkey" FOREIGN KEY ("tenant_id","author_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_user_fkey" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "watchlist_entries" ADD CONSTRAINT "watchlist_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "watchlist_entries" ADD CONSTRAINT "watchlist_entries_tenant_user_fkey" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "watchlist_entries" ADD CONSTRAINT "watchlist_entries_tenant_product_fkey" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."products"("tenant_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("tenant_id","user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("tenant_id","user_id") WHERE "notifications"."is_read" = false;--> statement-breakpoint
CREATE INDEX "order_items_seller_idx" ON "order_items" USING btree ("tenant_id","seller_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "orders_buyer_idx" ON "orders" USING btree ("tenant_id","buyer_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "products_catalog_idx" ON "products" USING btree ("tenant_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "products_seller_idx" ON "products" USING btree ("tenant_id","seller_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("tenant_id","category","subcategory","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reviews_product_idx" ON "reviews" USING btree ("tenant_id","product_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("tenant_id","user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_email_key" ON "users" USING btree ("tenant_id",lower("email"));--> statement-breakpoint
CREATE INDEX "watchlist_entries_user_idx" ON "watchlist_entries" USING btree ("tenant_id","user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
