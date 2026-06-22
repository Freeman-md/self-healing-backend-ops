import { IRepository } from "@/shared/contracts/repository.interface";
import { CreateWorkOrderInput, UpdateWorkOrderInput } from "./work-order.model";
import { WorkOrder } from "@prisma/client";

export interface IWorkOrderRepository
  extends IRepository<WorkOrder, CreateWorkOrderInput, UpdateWorkOrderInput> { }
