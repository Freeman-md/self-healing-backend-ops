import { HttpError } from "@/shared/http-error";

import type {
  CreateWorkOrderUpdateInput,
  UpdateWorkOrderUpdateInput,
} from "./work-order-update.model";
import { IWorkOrderUpdateRepository } from "./work-order-update.repository.interface";

export class WorkOrderUpdateService {
  constructor(private readonly repository: IWorkOrderUpdateRepository) {}

  createWorkOrderUpdate = async (input: CreateWorkOrderUpdateInput) => {
    try {
      return await this.repository.create(input);
    } catch (error) {
      if (error instanceof Error && error.message === "work order not found") {
        throw new HttpError(404, "work order not found");
      }

      throw error;
    }
  };

  getWorkOrderUpdate = async (updateId: string) => {
    const update = await this.repository.findById(updateId);

    if (!update) {
      throw new HttpError(404, "work order update not found");
    }

    return update;
  };

  listWorkOrderUpdates = async (workOrderId: string) => {
    return this.repository.findByWorkOrderId(workOrderId);
  };

  updateWorkOrderUpdate = async (
    updateId: string,
    input: UpdateWorkOrderUpdateInput,
  ) => {
    const update = await this.repository.update(updateId, input);

    if (!update) {
      throw new HttpError(404, "work order update not found");
    }

    return update;
  };

  deleteWorkOrderUpdate = async (updateId: string) => {
    const deleted = await this.repository.delete(updateId);

    if (!deleted) {
      throw new HttpError(404, "work order update not found");
    }

    return deleted;
  };
}
