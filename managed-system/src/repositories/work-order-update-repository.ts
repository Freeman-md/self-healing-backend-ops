import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import { databaseAccess } from "@/infrastructure/database/service";
import {
  workOrdersTable,
  workOrderUpdatesTable,
} from "@/infrastructure/database/schema";
import type { IWorkOrderUpdateRepository } from "@/interfaces/work-order-update-repository-interface";
import type {
  CreateWorkOrderUpdateInput,
  UpdateWorkOrderUpdateInput,
  WorkOrderUpdate,
} from "@/types/work-order";

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

class PostgresWorkOrderUpdateRepository
  implements IWorkOrderUpdateRepository
{
  async create(input: CreateWorkOrderUpdateInput): Promise<WorkOrderUpdate> {
    if (!input.workOrderId) {
      throw new Error("workOrderId is required");
    }

    const now = new Date().toISOString();

    return databaseAccess.client.transaction(async (transaction) => {
      const workOrderRows = await transaction
        .update(workOrdersTable)
        .set({
          updatedAt: now,
        })
        .where(eq(workOrdersTable.id, input.workOrderId!))
        .returning({ id: workOrdersTable.id });

      if (workOrderRows.length === 0) {
        throw new Error("work order not found");
      }

      const updateRows = await transaction
        .insert(workOrderUpdatesTable)
        .values({
          id: randomUUID(),
          workOrderId: input.workOrderId!,
          note: input.note,
          createdAt: now,
        })
        .returning();

      const update = updateRows[0];

      if (!update) {
        throw new Error("failed to create work order update");
      }

      return mapWorkOrderUpdateRow(update);
    });
  }

  async update(
    id: string,
    input: UpdateWorkOrderUpdateInput,
  ): Promise<WorkOrderUpdate | null> {
    const row = await databaseAccess.queryFirst((database) =>
      database
        .update(workOrderUpdatesTable)
        .set({
          note: input.note,
        })
        .where(eq(workOrderUpdatesTable.id, id))
        .returning(),
    );

    return row ? mapWorkOrderUpdateRow(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const row = await databaseAccess.queryFirst((database) =>
      database
        .delete(workOrderUpdatesTable)
        .where(eq(workOrderUpdatesTable.id, id))
        .returning({ id: workOrderUpdatesTable.id }),
    );

    return Boolean(row);
  }

  async findById(id: string): Promise<WorkOrderUpdate | null> {
    const row = await databaseAccess.queryFirst((database) =>
      database
        .select()
        .from(workOrderUpdatesTable)
        .where(eq(workOrderUpdatesTable.id, id)),
    );

    return row ? mapWorkOrderUpdateRow(row) : null;
  }

  async findAll(): Promise<WorkOrderUpdate[]> {
    const rows = await databaseAccess.queryMany((database) =>
      database
        .select()
        .from(workOrderUpdatesTable)
        .orderBy(asc(workOrderUpdatesTable.createdAt)),
    );

    return rows.map(mapWorkOrderUpdateRow);
  }

  async findByWorkOrderId(workOrderId: string): Promise<WorkOrderUpdate[]> {
    const rows = await databaseAccess.queryMany((database) =>
      database
        .select()
        .from(workOrderUpdatesTable)
        .where(eq(workOrderUpdatesTable.workOrderId, workOrderId))
        .orderBy(asc(workOrderUpdatesTable.createdAt)),
    );

    return rows.map(mapWorkOrderUpdateRow);
  }
}

export const workOrderUpdateRepository = new PostgresWorkOrderUpdateRepository();
