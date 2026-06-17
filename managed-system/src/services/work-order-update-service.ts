import type { IWorkOrderUpdateRepository } from "@/interfaces/work-order-update-repository-interface";
import { HttpError } from "@/shared/http-error";
import type {
  CreateWorkOrderUpdateInput,
  UpdateWorkOrderUpdateInput,
} from "@/types/work-order";

import { workOrderUpdateRepository } from "@/repositories/work-order-update-repository";

export class WorkOrderUpdateService {
  constructor(private readonly repository: IWorkOrderUpdateRepository) {}

  async createWorkOrderUpdate(input: CreateWorkOrderUpdateInput) {
    try {
      return await this.repository.create(input);
    } catch (error) {
      if (error instanceof Error && error.message === "work order not found") {
        throw new HttpError(404, "work order not found");
      }

      throw error;
    }
  }

  async getWorkOrderUpdate(updateId: string) {
    const update = await this.repository.findById(updateId);

    if (!update) {
      throw new HttpError(404, "work order update not found");
    }

    return update;
  }

  async listWorkOrderUpdates(workOrderId: string) {
    return this.repository.findByWorkOrderId(workOrderId);
  }

  async updateWorkOrderUpdate(
    updateId: string,
    input: UpdateWorkOrderUpdateInput,
  ) {
    const update = await this.repository.update(updateId, input);

    if (!update) {
      throw new HttpError(404, "work order update not found");
    }

    return update;
  }

  async deleteWorkOrderUpdate(updateId: string) {
    const deleted = await this.repository.delete(updateId);

    if (!deleted) {
      throw new HttpError(404, "work order update not found");
    }

    return deleted;
  }
}

export const workOrderUpdateService = new WorkOrderUpdateService(
  workOrderUpdateRepository,
);
