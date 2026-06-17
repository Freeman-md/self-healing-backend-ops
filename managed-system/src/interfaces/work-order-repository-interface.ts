import type {
  CreateWorkOrderInput,
  UpdateWorkOrderStatusInput,
  WorkOrder,
  WorkOrderUpdate,
} from "@/types/work-order";

export interface WorkOrderRepositoryInterface {
  create(input: CreateWorkOrderInput): Promise<WorkOrder>;
  findAll(): Promise<WorkOrder[]>;
  findById(id: string): Promise<WorkOrder | null>;
  updateStatus(
    id: string,
    input: UpdateWorkOrderStatusInput,
  ): Promise<WorkOrder | null>;
  addUpdate(id: string, note: string): Promise<WorkOrderUpdate | null>;
  findUpdatesByWorkOrderId(id: string): Promise<WorkOrderUpdate[] | null>;
}
