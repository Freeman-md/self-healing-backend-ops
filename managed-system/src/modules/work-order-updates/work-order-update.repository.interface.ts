import { WorkOrderUpdate } from "@prisma/client";

import { IRepository } from "@/shared/contracts/repository.interface";

import type {
  CreateWorkOrderUpdateInput,
  UpdateWorkOrderUpdateInput,
} from "./work-order-update.model";

export interface IWorkOrderUpdateRepository
  extends IRepository<
    WorkOrderUpdate,
    CreateWorkOrderUpdateInput,
    UpdateWorkOrderUpdateInput
  > {
  findByWorkOrderId(workOrderId: string): Promise<WorkOrderUpdate[]>;
}
