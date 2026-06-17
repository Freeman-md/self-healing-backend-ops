import type { Request, Response } from "express";

import {
  parseAddWorkOrderUpdateInput,
  parseCreateWorkOrderInput,
  parseUpdateWorkOrderStatusInput,
} from "@/dtos/work-order";
import { workOrderService } from "@/services/work-order-service";
import { readRequiredPathParam } from "@/shared/request-params";

export class WorkOrderController {
  createWorkOrder(request: Request, response: Response) {
    const input = parseCreateWorkOrderInput(request.body);
    const workOrder = workOrderService.createWorkOrder(input);

    return response.status(201).json({ data: workOrder });
  }

  listWorkOrders(_request: Request, response: Response) {
    const workOrders = workOrderService.listWorkOrders();

    return response.status(200).json({ data: workOrders });
  }

  getWorkOrder(request: Request, response: Response) {
    const workOrder = workOrderService.getWorkOrder(
      readRequiredPathParam(request.params.id, "id"),
    );

    return response.status(200).json({ data: workOrder });
  }

  updateWorkOrderStatus(request: Request, response: Response) {
    const input = parseUpdateWorkOrderStatusInput(request.body);
    const workOrder = workOrderService.updateWorkOrderStatus(
      readRequiredPathParam(request.params.id, "id"),
      input,
    );

    return response.status(200).json({ data: workOrder });
  }

  addWorkOrderUpdate(request: Request, response: Response) {
    const input = parseAddWorkOrderUpdateInput(request.body);
    const update = workOrderService.addWorkOrderUpdate(
      readRequiredPathParam(request.params.id, "id"),
      input,
    );

    return response.status(201).json({ data: update });
  }

  listWorkOrderUpdates(request: Request, response: Response) {
    const updates = workOrderService.listWorkOrderUpdates(
      readRequiredPathParam(request.params.id, "id"),
    );

    return response.status(200).json({ data: updates });
  }
}

export const workOrderController = new WorkOrderController();
