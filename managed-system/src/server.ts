import { createApp } from "./app.js";
import { config } from "./config/index.js";

const app = createApp();

console.info(
  `Managed system bootstrap prepared for ${config.server.environment} on port ${config.server.port}`,
);

void app;
