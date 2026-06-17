import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import { databaseAccess } from "@/infrastructure/database/service";
import {
  workOrdersTable,
  workOrderUpdatesTable,
} from "@/infrastructure/database/schema";
import type { WorkOrderRepositoryInterface } from "@/interfaces/work-order-repository-interface";
import type {
  CreateWorkOrderInput,
  UpdateWorkOrderStatusInput,
  WorkOrder,
  WorkOrderUpdate,
} from "@/types/work-order";

function mapWorkOrderRow(row: typeof workOrdersTable.$inferSelect): WorkOrder {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    assignee: row.assignee,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapWorkOrderUpdateRow(
  row: typeof workOrderUpdatesTable.$inferSelect,
): WorkOrderUpdate {
  return {
    id: row.id,
    workOrderId: row.workOrderId,
    note: row.note,
    createdAt: row.createdAt,
  };
}

class PostgresWorkOrderRepository implements WorkOrderRepositoryInterface {
  async create(input: CreateWorkOrderInput): Promise<WorkOrder> {
    const now = new Date().toISOString();
    const row = await databaseAccess.queryFirst((database) =>
      database
        .insert(workOrdersTable)
        .values({
          id: randomUUID(),
          title: input.title,
          description: input.description,
          status: "open",
          assignee: input.assignee ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning(),
    );

    if (!row) {
      throw new Error("failed to create work order");
    }

    return mapWorkOrderRow(row);
  }

  async findAll(): Promise<WorkOrder[]> {
    const rows = await databaseAccess.queryMany((database) =>
      database
        .select()
        .from(workOrdersTable)
        .orderBy(asc(workOrdersTable.createdAt)),
    );

    return rows.map(mapWorkOrderRow);
  }

  async findById(id: string): Promise<WorkOrder | null> {
    const row = await databaseAccess.queryFirst((database) =>
      database.select().from(workOrdersTable).where(eq(workOrdersTable.id, id)),
    );

    return row ? mapWorkOrderRow(row) : null;
  }

  async updateStatus(
    id: string,
    input: UpdateWorkOrderStatusInput,
  ): Promise<WorkOrder | null> {
    const row = await databaseAccess.queryFirst((database) =>
      database
        .update(workOrdersTable)
        .set({
          status: input.status,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workOrdersTable.id, id))
        .returning(),
    );

    return row ? mapWorkOrderRow(row) : null;
  }

  async addUpdate(id: string, note: string): Promise<WorkOrderUpdate | null> {
    const now = new Date().toISOString();

    return databaseAccess.client.transaction(async (transaction) => {
      const workOrderRows = await transaction
        .update(workOrdersTable)
        .set({
          updatedAt: now,
        })
        .where(eq(workOrdersTable.id, id))
        .returning();
      const workOrder = workOrderRows[0] ?? null;

      if (!workOrder) {
        return null;
      }

      const updateRows = await transaction
        .insert(workOrderUpdatesTable)
        .values({
          id: randomUUID(),
          workOrderId: id,
          note,
          createdAt: now,
        })
        .returning();
      const update = updateRows[0] ?? null;

      if (!update) {
        throw new Error("failed to create work order update");
      }

      return mapWorkOrderUpdateRow(update);
    });
  }

  async findUpdatesByWorkOrderId(id: string): Promise<WorkOrderUpdate[] | null> {
    const workOrder = await this.findById(id);

    if (!workOrder) {
      return null;
    }

    const rows = await databaseAccess.queryMany((database) =>
      database
        .select()
        .from(workOrderUpdatesTable)
        .where(eq(workOrderUpdatesTable.workOrderId, id))
        .orderBy(asc(workOrderUpdatesTable.createdAt)),
    );

    return rows.map(mapWorkOrderUpdateRow);
  }
}

export const workOrderRepository = new PostgresWorkOrderRepository();
