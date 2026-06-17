import { Router } from "express";

import { workOrderController } from "@/controllers/work-order-controller";
import { workOrderUpdateRoutes } from "@/routes/work-order-update-routes";

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
workOrderRoutes.patch("/:id", (request, response) =>
  workOrderController.updateWorkOrder(request, response),
);
workOrderRoutes.use("/:workOrderId/updates", workOrderUpdateRoutes);
