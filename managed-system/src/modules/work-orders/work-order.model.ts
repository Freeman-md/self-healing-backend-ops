import { WorkOrderStatus } from "@prisma/client";

export type CreateWorkOrderInput = {
  title: string;
  description: string;
  status?: WorkOrderStatus;
  assignee?: string | null;
};

export type UpdateWorkOrderInput = {
  title?: string;
  description?: string;
  status?: WorkOrderStatus;
  assignee?: string | null;
};

export type WorkOrderUpdate = {
  id: string;
  workOrderId: string;
  note: string;
  createdAt: string;
};
