import { randomUUID } from "node:crypto";

import type {
  CreateWorkOrderInput,
  UpdateWorkOrderStatusInput,
  WorkOrder,
  WorkOrderUpdate,
} from "@/types/work-order";

export interface WorkOrderRepository {
  create(input: CreateWorkOrderInput): WorkOrder;
  findAll(): WorkOrder[];
  findById(id: string): WorkOrder | null;
  updateStatus(id: string, input: UpdateWorkOrderStatusInput): WorkOrder | null;
  addUpdate(id: string, note: string): WorkOrderUpdate | null;
  findUpdatesByWorkOrderId(id: string): WorkOrderUpdate[] | null;
}

class InMemoryWorkOrderRepository implements WorkOrderRepository {
  private readonly workOrders = new Map<string, WorkOrder>();
  private readonly workOrderUpdates = new Map<string, WorkOrderUpdate[]>();

  create(input: CreateWorkOrderInput): WorkOrder {
    const now = new Date().toISOString();
    const workOrder: WorkOrder = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      status: "open",
      assignee: input.assignee ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.workOrders.set(workOrder.id, workOrder);
    this.workOrderUpdates.set(workOrder.id, []);

    return workOrder;
  }

  findAll(): WorkOrder[] {
    return Array.from(this.workOrders.values());
  }

  findById(id: string): WorkOrder | null {
    return this.workOrders.get(id) ?? null;
  }

  updateStatus(id: string, input: UpdateWorkOrderStatusInput): WorkOrder | null {
    const existing = this.workOrders.get(id);

    if (!existing) {
      return null;
    }

    const updated: WorkOrder = {
      ...existing,
      status: input.status,
      updatedAt: new Date().toISOString(),
    };

    this.workOrders.set(id, updated);

    return updated;
  }

  addUpdate(id: string, note: string): WorkOrderUpdate | null {
    const existing = this.workOrders.get(id);
    const existingUpdates = this.workOrderUpdates.get(id);

    if (!existing || !existingUpdates) {
      return null;
    }

    const update: WorkOrderUpdate = {
      id: randomUUID(),
      workOrderId: id,
      note,
      createdAt: new Date().toISOString(),
    };

    existing.updatedAt = update.createdAt;

    existingUpdates.push(update);
    this.workOrderUpdates.set(id, existingUpdates);

    return update;
  }

  findUpdatesByWorkOrderId(id: string): WorkOrderUpdate[] | null {
    if (!this.workOrders.has(id)) {
      return null;
    }

    return this.workOrderUpdates.get(id) ?? [];
  }
}

export const workOrderRepository = new InMemoryWorkOrderRepository();
