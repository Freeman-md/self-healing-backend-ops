import { HttpError } from "@/shared/http-error";
import { CreateWorkOrderInput, UpdateWorkOrderInput } from "./work-order.model";
import { IWorkOrderRepository } from "./work-order.repository.interface";
import { appLogger } from "@/observability/logging/app-logger";

export class WorkOrderService {
  constructor(private readonly repository: IWorkOrderRepository) {}

  createWorkOrder = async(input: CreateWorkOrderInput) => {
    const workOrder = await this.repository.create(input);

    appLogger.info("work_order_created", {
      workOrderId: workOrder.id,
      status: workOrder.status,
      assignee: workOrder.assignee,
    });

    return workOrder
  }

  listWorkOrders = async() => {
    return await this.repository.findAll();
  }

  getWorkOrder = async(id: string) => {
    const workOrder = await this.repository.findById(id);

    if (!workOrder) {
      throw new HttpError(404, "work order not found");
    }

    return workOrder;
  }

  updateWorkOrder = async(id: string, input: UpdateWorkOrderInput) => {
    const workOrder = await this.repository.update(id, input);

    if (!workOrder) {
      throw new HttpError(404, "work order not found");
    }

    appLogger.info("work_order_updated", {
      workOrderId: workOrder.id,
      status: workOrder.status,
      assignee: workOrder.assignee,
      updatedFields: Object.keys(input),
    });

    return workOrder;
  }

  deleteWorkOrder = async(id: string) => {
    const deleted = await this.repository.delete(id);

    if (!deleted) {
      throw new HttpError(404, "work order not found");
    }

    appLogger.info("work_order_deleted", {
      workOrderId: id,
    });

    return deleted;
  }
}
