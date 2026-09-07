import type { Request, Response } from "express";

import { readRequiredPathParam } from "@/shared/request-params";

import {
  parseCreateWorkOrderUpdateInput,
  parseUpdateWorkOrderUpdateInput,
} from "./work-order-update.input";
import { WorkOrderUpdateService } from "./work-order-update.service";

export class WorkOrderUpdateController {
  constructor(private readonly workOrderUpdateService: WorkOrderUpdateService) {}

  createWorkOrderUpdate = async (request: Request, response: Response) => {
    const input = parseCreateWorkOrderUpdateInput(request.body);

    const workOrderId = readRequiredPathParam(request.params.workOrderId, "workOrderId");

    const update = await this.workOrderUpdateService.createWorkOrderUpdate({
      ...input,
      workOrderId,
    });

    return response.status(201).json({ data: update });
  };

  listWorkOrderUpdates = async (request: Request, response: Response) => {
    const workOrderId = readRequiredPathParam(request.params.workOrderId, "workOrderId");

    const updates = await this.workOrderUpdateService.listWorkOrderUpdates(workOrderId);

    return response.status(200).json({ data: updates });
  };

  getWorkOrderUpdate = async (request: Request, response: Response) => {
    const workOrderId = readRequiredPathParam(request.params.workOrderId, "workOrderId");

    const updateId = readRequiredPathParam(request.params.updateId, "updateId");

    const update = await this.workOrderUpdateService.getWorkOrderUpdate(updateId);

    if (update.workOrderId !== workOrderId) {
      return response.status(404).json({
        error: "work order update not found",
      });
    }

    return response.status(200).json({ data: update });
  };

  updateWorkOrderUpdate = async (request: Request, response: Response) => {
    const workOrderId = readRequiredPathParam(request.params.workOrderId, "workOrderId");

    const updateId = readRequiredPathParam(request.params.updateId, "updateId");

    const input = parseUpdateWorkOrderUpdateInput(request.body);

    const update = await this.workOrderUpdateService.updateWorkOrderUpdate(updateId, input);

    if (update.workOrderId !== workOrderId) {
      return response.status(404).json({
        error: "work order update not found",
      });
    }

    return response.status(200).json({ data: update });
  };

  deleteWorkOrderUpdate = async (request: Request, response: Response) => {
    const workOrderId = readRequiredPathParam(request.params.workOrderId, "workOrderId");

    const updateId = readRequiredPathParam(request.params.updateId, "updateId");

    const update = await this.workOrderUpdateService.getWorkOrderUpdate(updateId);

    if (update.workOrderId !== workOrderId) {
      return response.status(404).json({
        error: "work order update not found",
      });
    }

    await this.workOrderUpdateService.deleteWorkOrderUpdate(updateId);

    return response.status(204).send();
  };
}
