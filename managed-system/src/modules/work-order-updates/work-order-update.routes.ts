import { Router } from "express";

import { prisma } from "@/shared/db/prisma";

import { WorkOrderUpdateController } from "./work-order-update.controller";
import { WorkOrderUpdateRepository } from "./work-order-update.repository";
import { WorkOrderUpdateService } from "./work-order-update.service";

export const workOrderUpdateRoutes = Router({
  mergeParams: true,
});

const workOrderUpdateRepository = new WorkOrderUpdateRepository(prisma);
const workOrderUpdateService = new WorkOrderUpdateService(
  workOrderUpdateRepository,
);
const workOrderUpdateController = new WorkOrderUpdateController(
  workOrderUpdateService,
);

workOrderUpdateRoutes.post("/", (request, response) =>
  workOrderUpdateController.createWorkOrderUpdate(request, response),
);
workOrderUpdateRoutes.get("/", (request, response) =>
  workOrderUpdateController.listWorkOrderUpdates(request, response),
);
workOrderUpdateRoutes.get("/:updateId", (request, response) =>
  workOrderUpdateController.getWorkOrderUpdate(request, response),
);
workOrderUpdateRoutes.patch("/:updateId", (request, response) =>
  workOrderUpdateController.updateWorkOrderUpdate(request, response),
);
workOrderUpdateRoutes.delete("/:updateId", (request, response) =>
  workOrderUpdateController.deleteWorkOrderUpdate(request, response),
);
