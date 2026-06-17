import type { Request, Response } from "express";

import {
  parseAddWorkOrderUpdateInput,
  parseCreateWorkOrderInput,
  parseUpdateWorkOrderStatusInput,
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

  async updateWorkOrderStatus(request: Request, response: Response) {
    const input = parseUpdateWorkOrderStatusInput(request.body);
    const workOrder = await workOrderService.updateWorkOrderStatus(
      readRequiredPathParam(request.params.id, "id"),
      input,
    );

    return response.status(200).json({ data: workOrder });
  }

  async addWorkOrderUpdate(request: Request, response: Response) {
    const input = parseAddWorkOrderUpdateInput(request.body);
    const update = await workOrderService.addWorkOrderUpdate(
      readRequiredPathParam(request.params.id, "id"),
      input,
    );

    return response.status(201).json({ data: update });
  }

  async listWorkOrderUpdates(request: Request, response: Response) {
    const updates = await workOrderService.listWorkOrderUpdates(
      readRequiredPathParam(request.params.id, "id"),
    );

    return response.status(200).json({ data: updates });
  }
}

export const workOrderController = new WorkOrderController();
