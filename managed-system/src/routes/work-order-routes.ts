import { Router } from "express";

import { workOrderController } from "@/controllers/work-order-controller";

export const workOrderRoutes = Router();

workOrderRoutes.post("/", (request, response) =>
  workOrderController.createWorkOrder(request, response),
);
workOrderRoutes.get("/", (request, response) =>
  workOrderController.listWorkOrders(request, response),
);
workOrderRoutes.get("/:id", (request, response) =>
  workOrderController.getWorkOrder(request, response),
);
workOrderRoutes.patch("/:id/status", (request, response) =>
  workOrderController.updateWorkOrderStatus(request, response),
);
workOrderRoutes.post("/:id/updates", (request, response) =>
  workOrderController.addWorkOrderUpdate(request, response),
);
workOrderRoutes.get("/:id/updates", (request, response) =>
  workOrderController.listWorkOrderUpdates(request, response),
);
