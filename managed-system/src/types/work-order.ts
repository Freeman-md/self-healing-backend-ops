export const WORK_ORDER_STATUSES = [
  "open",
  "in_progress",
  "blocked",
  "resolved",
  "closed",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: WorkOrderStatus;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderUpdate {
  id: string;
  workOrderId: string;
  note: string;
  createdAt: string;
}

export interface CreateWorkOrderInput {
  title: string;
  description: string;
  assignee?: string | null;
}

export interface UpdateWorkOrderStatusInput {
  status: WorkOrderStatus;
}

export interface AddWorkOrderUpdateInput {
  note: string;
}
