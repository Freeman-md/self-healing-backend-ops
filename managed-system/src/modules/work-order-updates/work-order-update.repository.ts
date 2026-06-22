import { Prisma, PrismaClient, WorkOrderUpdate } from "@prisma/client";

import type {
  CreateWorkOrderUpdateInput,
  UpdateWorkOrderUpdateInput,
} from "./work-order-update.model";
import { IWorkOrderUpdateRepository } from "./work-order-update.repository.interface";

export class WorkOrderUpdateRepository
  implements IWorkOrderUpdateRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateWorkOrderUpdateInput): Promise<WorkOrderUpdate> {
    const { workOrderId, note } = data;

    if (!workOrderId) {
      throw new Error("workOrderId is required");
    }

    return this.prisma.$transaction(async (transaction) => {
      const workOrder = await transaction.workOrder.findUnique({
        where: { id: workOrderId },
        select: { id: true },
      });

      if (!workOrder) {
        throw new Error("work order not found");
      }

      await transaction.workOrder.update({
        where: { id: workOrderId },
        data: {
          updatedAt: new Date(),
        },
      });

      return transaction.workOrderUpdate.create({
        data: {
          workOrderId,
          note,
        },
      });
    });
  }

  async update(
    id: string,
    data: UpdateWorkOrderUpdateInput,
  ): Promise<WorkOrderUpdate | null> {
    try {
      return await this.prisma.workOrderUpdate.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return null;
      }

      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.workOrderUpdate.delete({
        where: { id },
      });

      return true;
    } catch {
      return false;
    }
  }

  findById(id: string): Promise<WorkOrderUpdate | null> {
    return this.prisma.workOrderUpdate.findUnique({
      where: { id },
    });
  }

  findAll(): Promise<WorkOrderUpdate[]> {
    return this.prisma.workOrderUpdate.findMany({
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  findByWorkOrderId(workOrderId: string): Promise<WorkOrderUpdate[]> {
    return this.prisma.workOrderUpdate.findMany({
      where: { workOrderId },
      orderBy: {
        createdAt: "asc",
      },
    });
  }
}
