import type { Request, Response } from "express";

import {
  parseCreateWorkOrderInput,
  parseUpdateWorkOrderInput,
} from "@/modules/work-orders/work-order.input";
import { readRequiredPathParam } from "@/shared/request-params";
import { WorkOrderService } from "./work-order.service";

export class WorkOrderController {
  constructor(private readonly workOrderService: WorkOrderService) {}

  createWorkOrder = async (request: Request, response: Response) => {
    const input = parseCreateWorkOrderInput(request.body);

    const workOrder = await this.workOrderService.createWorkOrder(input);

    return response.status(201).json({ data: workOrder });
  };

  listWorkOrders = async (_request: Request, response: Response) => {
    const workOrders = await this.workOrderService.listWorkOrders();

    return response.status(200).json({ data: workOrders });
  };

  getWorkOrder = async (request: Request, response: Response) => {
    const workOrder = await this.workOrderService.getWorkOrder(
      readRequiredPathParam(request.params.id, "id"),
    );

    return response.status(200).json({ data: workOrder });
  };

  updateWorkOrder = async (request: Request, response: Response) => {
    const input = parseUpdateWorkOrderInput(request.body);

    const workOrder = await this.workOrderService.updateWorkOrder(
      readRequiredPathParam(request.params.id, "id"),
      input,
    );

    return response.status(200).json({ data: workOrder });
  };

  deleteWorkOrder = async (request: Request, response: Response) => {
    await this.workOrderService.deleteWorkOrder(readRequiredPathParam(request.params.id, "id"));

    return response.status(204).send();
  };
}
