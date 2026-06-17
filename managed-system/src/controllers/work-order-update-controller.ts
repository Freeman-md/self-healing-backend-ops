import type { Request, Response } from "express";

import {
  parseCreateWorkOrderUpdateInput,
  parseUpdateWorkOrderUpdateInput,
} from "@/dtos/work-order-update";
import { workOrderUpdateService } from "@/services/work-order-update-service";
import { readRequiredPathParam } from "@/shared/request-params";

export class WorkOrderUpdateController {
  async createWorkOrderUpdate(request: Request, response: Response) {
    const input = parseCreateWorkOrderUpdateInput(request.body);
    const workOrderId = readRequiredPathParam(request.params.workOrderId, "workOrderId");
    const update = await workOrderUpdateService.createWorkOrderUpdate({
      ...input,
      workOrderId,
    });

    return response.status(201).json({ data: update });
  }

  async listWorkOrderUpdates(request: Request, response: Response) {
    const workOrderId = readRequiredPathParam(request.params.workOrderId, "workOrderId");
    const updates = await workOrderUpdateService.listWorkOrderUpdates(workOrderId);

    return response.status(200).json({ data: updates });
  }

  async getWorkOrderUpdate(request: Request, response: Response) {
    const workOrderId = readRequiredPathParam(request.params.workOrderId, "workOrderId");
    const updateId = readRequiredPathParam(request.params.updateId, "updateId");
    const update = await workOrderUpdateService.getWorkOrderUpdate(updateId);

    if (update.workOrderId !== workOrderId) {
      return response.status(404).json({
        error: "work order update not found",
      });
    }

    return response.status(200).json({ data: update });
  }

  async updateWorkOrderUpdate(request: Request, response: Response) {
    const workOrderId = readRequiredPathParam(request.params.workOrderId, "workOrderId");
    const updateId = readRequiredPathParam(request.params.updateId, "updateId");
    const input = parseUpdateWorkOrderUpdateInput(request.body);
    const update = await workOrderUpdateService.updateWorkOrderUpdate(updateId, input);

    if (update.workOrderId !== workOrderId) {
      return response.status(404).json({
        error: "work order update not found",
      });
    }

    return response.status(200).json({ data: update });
  }

  async deleteWorkOrderUpdate(request: Request, response: Response) {
    const workOrderId = readRequiredPathParam(request.params.workOrderId, "workOrderId");
    const updateId = readRequiredPathParam(request.params.updateId, "updateId");
    const update = await workOrderUpdateService.getWorkOrderUpdate(updateId);

    if (update.workOrderId !== workOrderId) {
      return response.status(404).json({
        error: "work order update not found",
      });
    }

    await workOrderUpdateService.deleteWorkOrderUpdate(updateId);

    return response.status(204).send();
  }
}

export const workOrderUpdateController = new WorkOrderUpdateController();
