import { Router } from "express";

import { workOrderUpdateController } from "@/controllers/work-order-update-controller";

export const workOrderUpdateRoutes = Router({
  mergeParams: true,
});

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
