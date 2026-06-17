import type {
  CreateWorkOrderInput,
  UpdateWorkOrderStatusInput,
  WorkOrder,
  WorkOrderUpdate,
} from "@/types/work-order";

export interface WorkOrderRepositoryInterface {
  create(input: CreateWorkOrderInput): WorkOrder;
  findAll(): WorkOrder[];
  findById(id: string): WorkOrder | null;
  updateStatus(id: string, input: UpdateWorkOrderStatusInput): WorkOrder | null;
  addUpdate(id: string, note: string): WorkOrderUpdate | null;
  findUpdatesByWorkOrderId(id: string): WorkOrderUpdate[] | null;
}
