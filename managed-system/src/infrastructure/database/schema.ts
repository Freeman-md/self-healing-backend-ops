import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { WORK_ORDER_STATUSES } from "@/types/work-order";

export const workOrderStatusEnum = pgEnum(
  "work_order_status",
  WORK_ORDER_STATUSES,
);

export const workOrdersTable = pgTable("work_orders", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: workOrderStatusEnum("status").notNull(),
  assignee: text("assignee"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
});

export const workOrderUpdatesTable = pgTable(
  "work_order_updates",
  {
    id: text("id").primaryKey(),
    workOrderId: text("work_order_id")
      .notNull()
      .references(() => workOrdersTable.id, {
        onDelete: "cascade",
      }),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => ({
    workOrderIdIndex: index("work_order_updates_work_order_id_idx").on(
      table.workOrderId,
    ),
  }),
);
