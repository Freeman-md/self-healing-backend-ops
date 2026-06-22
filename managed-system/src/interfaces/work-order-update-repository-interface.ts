import type { IRepository } from "@/shared/contracts/repository.interface";
import type {
  CreateWorkOrderUpdateInput,
  UpdateWorkOrderUpdateInput,
  WorkOrderUpdate,
} from "@/types/work-order";

export interface IWorkOrderUpdateRepository
  extends IRepository<
    WorkOrderUpdate,
    CreateWorkOrderUpdateInput,
    UpdateWorkOrderUpdateInput
  > {
  findByWorkOrderId(workOrderId: string): Promise<WorkOrderUpdate[]>;
}
