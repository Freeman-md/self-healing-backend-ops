import type { Request, Response } from "express";

import {
  parseCreateWorkOrderInput,
  parseUpdateWorkOrderInput,
} from "@/dtos/work-order";
import { workOrderService } from "@/services/work-order-service";
import { readRequiredPathParam } from "@/shared/request-params";

export class WorkOrderController {
  async createWorkOrder(request: Request, response: Response) {
    const input = parseCreateWorkOrderInput(request.body);
    const workOrder = await workOrderService.createWorkOrder(input);

    return response.status(201).json({ data: workOrder });
  }

  async listWorkOrders(_request: Request, response: Response) {
    const workOrders = await workOrderService.listWorkOrders();

    return response.status(200).json({ data: workOrders });
  }

  async getWorkOrder(request: Request, response: Response) {
    const workOrder = await workOrderService.getWorkOrder(
      readRequiredPathParam(request.params.id, "id"),
    );

    return response.status(200).json({ data: workOrder });
  }

  async updateWorkOrder(request: Request, response: Response) {
    const input = parseUpdateWorkOrderInput(request.body);
    const workOrder = await workOrderService.updateWorkOrder(
      readRequiredPathParam(request.params.id, "id"),
      input,
    );

    return response.status(200).json({ data: workOrder });
  }
}

export const workOrderController = new WorkOrderController();
