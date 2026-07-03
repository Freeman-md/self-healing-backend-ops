import { HttpError } from "@/shared/http-error";

import type {
  CreateWorkOrderUpdateInput,
  UpdateWorkOrderUpdateInput,
} from "./work-order-update.model";
import { IWorkOrderUpdateRepository } from "./work-order-update.repository.interface";
import { appLogger } from "@/observability/logging/app-logger";

export class WorkOrderUpdateService {
  constructor(private readonly repository: IWorkOrderUpdateRepository) {}

  createWorkOrderUpdate = async (input: CreateWorkOrderUpdateInput) => {
    try {
      const update = await this.repository.create(input);

      appLogger.info("work_order_update_created", {
        updateId: update.id,
        workOrderId: update.workOrderId,
      });

      return update
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

    appLogger.info("work_order_update_updated", {
      updateId: update.id,
      workOrderId: update.workOrderId,
    });

    return update;
  };

  deleteWorkOrderUpdate = async (updateId: string) => {
    const deleted = await this.repository.delete(updateId);

    if (!deleted) {
      throw new HttpError(404, "work order update not found");
    }

     appLogger.info("work_order_update_deleted", {
      updateId,
    });


    return deleted;
  };
}
