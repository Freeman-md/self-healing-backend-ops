import { HttpError } from "@/shared/http-error";
import type {
  AddWorkOrderUpdateInput,
  CreateWorkOrderInput,
  UpdateWorkOrderStatusInput,
} from "@/types/work-order";

import {
  workOrderRepository,
  type WorkOrderRepository,
} from "@/repositories/work-order-repository";

export class WorkOrderService {
  constructor(private readonly repository: WorkOrderRepository) {}

  createWorkOrder(input: CreateWorkOrderInput) {
    return this.repository.create(input);
  }

  listWorkOrders() {
    return this.repository.findAll();
  }

  getWorkOrder(id: string) {
    const workOrder = this.repository.findById(id);

    if (!workOrder) {
      throw new HttpError(404, "work order not found");
    }

    return workOrder;
  }

  updateWorkOrderStatus(id: string, input: UpdateWorkOrderStatusInput) {
    const workOrder = this.repository.updateStatus(id, input);

    if (!workOrder) {
      throw new HttpError(404, "work order not found");
    }

    return workOrder;
  }

  addWorkOrderUpdate(id: string, input: AddWorkOrderUpdateInput) {
    const update = this.repository.addUpdate(id, input.note);

    if (!update) {
      throw new HttpError(404, "work order not found");
    }

    return update;
  }

  listWorkOrderUpdates(id: string) {
    const updates = this.repository.findUpdatesByWorkOrderId(id);

    if (!updates) {
      throw new HttpError(404, "work order not found");
    }

    return updates;
  }
}

export const workOrderService = new WorkOrderService(workOrderRepository);
