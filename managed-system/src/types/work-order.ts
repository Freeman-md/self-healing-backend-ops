export const WORK_ORDER_STATUSES = [
  "open",
  "in_progress",
  "blocked",
  "resolved",
  "closed",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export type WorkOrder = {
  id: string;
  title: string;
  description: string;
  status: WorkOrderStatus;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkOrderUpdate = {
  id: string;
  workOrderId: string;
  note: string;
  createdAt: string;
};

export type CreateWorkOrderInput = {
  title: string;
  description: string;
  assignee?: string | null;
};

export type UpdateWorkOrderInput = {
  title?: string;
  description?: string;
  status?: WorkOrderStatus;
  assignee?: string | null;
};

export type CreateWorkOrderUpdateInput = {
  workOrderId?: string;
  note: string;
};

export type UpdateWorkOrderUpdateInput = {
  note: string;
};
