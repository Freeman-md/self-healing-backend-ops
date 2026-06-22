import { HttpError } from "@/shared/http-error";
import { CreateWorkOrderInput, UpdateWorkOrderInput } from "./work-order.model";
import { IWorkOrderRepository } from "./work-order.repository.interface";

export class WorkOrderService {
  constructor(private readonly repository: IWorkOrderRepository) {}

  createWorkOrder = async(input: CreateWorkOrderInput) => {
    return this.repository.create(input);
  }

  listWorkOrders = async() => {
    return this.repository.findAll();
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

    return workOrder;
  }
}