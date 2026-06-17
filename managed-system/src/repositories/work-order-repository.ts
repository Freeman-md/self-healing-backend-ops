import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import { databaseService } from "@/infrastructure/database/service";
import { workOrdersTable } from "@/infrastructure/database/schema";
import type { IWorkOrderRepository } from "@/interfaces/work-order-repository-interface";
import type {
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
  WorkOrder,
} from "@/types/work-order";

function buildWorkOrderUpdateValues(input: UpdateWorkOrderInput) {
  const values: Partial<typeof workOrdersTable.$inferInsert> = {};

  if (input.title !== undefined) {
    values.title = input.title;
  }

  if (input.description !== undefined) {
    values.description = input.description;
  }

  if (input.status !== undefined) {
    values.status = input.status;
  }

  if (input.assignee !== undefined) {
    values.assignee = input.assignee;
  }

  return values;
}

class PostgresWorkOrderRepository implements IWorkOrderRepository {
  async create(input: CreateWorkOrderInput): Promise<WorkOrder> {
    const now = new Date().toISOString();
    const row = await databaseService.findFirst((database) =>
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

    return row satisfies WorkOrder;
  }

  async update(
    id: string,
    input: UpdateWorkOrderInput,
  ): Promise<WorkOrder | null> {
    const values = buildWorkOrderUpdateValues(input);

    const row = await databaseService.findFirst((database) =>
      database
        .update(workOrdersTable)
        .set({
          ...values,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workOrdersTable.id, id))
        .returning(),
    );

    return row;
  }

  async delete(id: string): Promise<boolean> {
    const row = await databaseService.findFirst((database) =>
      database
        .delete(workOrdersTable)
        .where(eq(workOrdersTable.id, id))
        .returning({ id: workOrdersTable.id }),
    );

    return Boolean(row);
  }

  async findById(id: string): Promise<WorkOrder | null> {
    const row = await databaseService.findFirst((database) =>
      database.select().from(workOrdersTable).where(eq(workOrdersTable.id, id)),
    );

    return row;
  }

  async findAll(): Promise<WorkOrder[]> {
    return databaseService.findMany((database) =>
      database
        .select()
        .from(workOrdersTable)
        .orderBy(asc(workOrdersTable.createdAt)),
    );
  }
}

export const workOrderRepository = new PostgresWorkOrderRepository();
