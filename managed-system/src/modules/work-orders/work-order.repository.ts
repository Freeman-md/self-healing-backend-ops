import { PrismaClient, WorkOrder } from "@prisma/client";

import type {
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
} from "./work-order.model";

import { IWorkOrderRepository } from "./work-order.repository.interface";

export class WorkOrderRepository implements IWorkOrderRepository {
  constructor(private readonly prisma: PrismaClient) { }

  create(data: CreateWorkOrderInput): Promise<WorkOrder> {
    return this.prisma.workOrder.create({
      data,
    });
  }

  findAll(): Promise<WorkOrder[]> {
    return this.prisma.workOrder.findMany({
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  findById(id: string): Promise<WorkOrder | null> {
    return this.prisma.workOrder.findUnique({
      where: { id },
    });
  }

  update(id: string, data: UpdateWorkOrderInput): Promise<WorkOrder> {
    return this.prisma.workOrder.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.workOrder.delete({
        where: { id },
      });

      return true
    } catch {
      return false
    }
  }
}