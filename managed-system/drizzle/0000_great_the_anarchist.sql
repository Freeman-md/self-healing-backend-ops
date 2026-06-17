CREATE TYPE "public"."work_order_status" AS ENUM('open', 'in_progress', 'blocked', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "work_order_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"work_order_id" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "work_order_status" NOT NULL,
	"assignee" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_order_updates" ADD CONSTRAINT "work_order_updates_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_order_updates_work_order_id_idx" ON "work_order_updates" USING btree ("work_order_id");