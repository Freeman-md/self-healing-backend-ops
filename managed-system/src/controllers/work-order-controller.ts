import type { Request, Response } from "express";

import { workOrderService } from "@/services/work-order-service";
import {
  validateAddWorkOrderUpdateInput,
  validateCreateWorkOrderInput,
  validateUpdateWorkOrderStatusInput,
} from "@/shared/work-order-validation";
import { HttpError } from "@/shared/http-error";

function readPathId(value: string | string[] | undefined): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  throw new HttpError(400, "id path parameter is required");
}

export class WorkOrderController {
  createWorkOrder(request: Request, response: Response) {
    const input = validateCreateWorkOrderInput(request.body);
    const workOrder = workOrderService.createWorkOrder(input);

    return response.status(201).json({ data: workOrder });
  }

  listWorkOrders(_request: Request, response: Response) {
    const workOrders = workOrderService.listWorkOrders();

    return response.status(200).json({ data: workOrders });
  }

  getWorkOrder(request: Request, response: Response) {
    const workOrder = workOrderService.getWorkOrder(readPathId(request.params.id));

    return response.status(200).json({ data: workOrder });
  }

  updateWorkOrderStatus(request: Request, response: Response) {
    const input = validateUpdateWorkOrderStatusInput(request.body);
    const workOrder = workOrderService.updateWorkOrderStatus(
      readPathId(request.params.id),
      input,
    );

    return response.status(200).json({ data: workOrder });
  }

  addWorkOrderUpdate(request: Request, response: Response) {
    const input = validateAddWorkOrderUpdateInput(request.body);
    const update = workOrderService.addWorkOrderUpdate(
      readPathId(request.params.id),
      input,
    );

    return response.status(201).json({ data: update });
  }

  listWorkOrderUpdates(request: Request, response: Response) {
    const updates = workOrderService.listWorkOrderUpdates(
      readPathId(request.params.id),
    );

    return response.status(200).json({ data: updates });
  }
}

export const workOrderController = new WorkOrderController();
