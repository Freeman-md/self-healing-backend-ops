import { createApp } from "@/app";
import { config } from "@/config/index";

const app = createApp();

console.info(
  `Managed system bootstrap prepared for ${config.server.environment} on port ${config.server.port}`,
);

void app;
