import type { IRepository } from "@/interfaces/repository";
import type {
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
  WorkOrder,
} from "@/types/work-order";

export interface IWorkOrderRepository
  extends IRepository<WorkOrder, CreateWorkOrderInput, UpdateWorkOrderInput> { }
