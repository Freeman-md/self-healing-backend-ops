import { Router } from "express";


import { workOrderUpdateRoutes } from "@/routes/work-order-update-routes";
import { WorkOrderRepository } from './work-order.repository';
import { WorkOrderService } from "./work-order.service";
import { WorkOrderController } from './work-order.controller';
import { prisma } from "@/shared/db/prisma";

export const workOrderRoutes = Router();

const workOrderRepository = new WorkOrderRepository(prisma)
const workOrderService = new WorkOrderService(workOrderRepository)
const workOrderController = new WorkOrderController(workOrderService)

workOrderRoutes.post("/", (request, response) =>
  workOrderController.createWorkOrder(request, response),
);
workOrderRoutes.get("/", (request, response) =>
  workOrderController.listWorkOrders(request, response),
);
workOrderRoutes.get("/:id", (request, response) =>
  workOrderController.getWorkOrder(request, response),
);
workOrderRoutes.patch("/:id", (request, response) =>
  workOrderController.updateWorkOrder(request, response),
);
workOrderRoutes.use("/:workOrderId/updates", workOrderUpdateRoutes);
