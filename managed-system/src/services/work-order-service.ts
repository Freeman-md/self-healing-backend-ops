import type { IWorkOrderRepository } from "@/interfaces/work-order-repository-interface";
import { HttpError } from "@/shared/http-error";
import type {
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
} from "@/types/work-order";

import { workOrderRepository } from "@/repositories/work-order-repository";

export class WorkOrderService {
  constructor(private readonly repository: IWorkOrderRepository) {}

  async createWorkOrder(input: CreateWorkOrderInput) {
    return this.repository.create(input);
  }

  async listWorkOrders() {
    return this.repository.findAll();
  }

  async getWorkOrder(id: string) {
    const workOrder = await this.repository.findById(id);

    if (!workOrder) {
      throw new HttpError(404, "work order not found");
    }

    return workOrder;
  }

  async updateWorkOrder(id: string, input: UpdateWorkOrderInput) {
    const workOrder = await this.repository.update(id, input);

    if (!workOrder) {
      throw new HttpError(404, "work order not found");
    }

    return workOrder;
  }
}

export const workOrderService = new WorkOrderService(workOrderRepository);
