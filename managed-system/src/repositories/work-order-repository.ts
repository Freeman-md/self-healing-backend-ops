import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import { databaseAccess } from "@/infrastructure/database/service";
import { workOrdersTable } from "@/infrastructure/database/schema";
import type { IWorkOrderRepository } from "@/interfaces/work-order-repository-interface";
import type {
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
  WorkOrder,
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

class PostgresWorkOrderRepository implements IWorkOrderRepository {
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

  async update(
    id: string,
    input: UpdateWorkOrderInput,
  ): Promise<WorkOrder | null> {
    const row = await databaseAccess.queryFirst((database) =>
      database
        .update(workOrdersTable)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.assignee !== undefined ? { assignee: input.assignee } : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workOrdersTable.id, id))
        .returning(),
    );

    return row ? mapWorkOrderRow(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const row = await databaseAccess.queryFirst((database) =>
      database
        .delete(workOrdersTable)
        .where(eq(workOrdersTable.id, id))
        .returning({ id: workOrdersTable.id }),
    );

    return Boolean(row);
  }

  async findById(id: string): Promise<WorkOrder | null> {
    const row = await databaseAccess.queryFirst((database) =>
      database.select().from(workOrdersTable).where(eq(workOrdersTable.id, id)),
    );

    return row ? mapWorkOrderRow(row) : null;
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
}

export const workOrderRepository = new PostgresWorkOrderRepository();
