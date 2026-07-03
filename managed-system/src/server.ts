import "dotenv/config";

import { createApp } from "@/app";
import { config } from "@/config/index";
import { logger } from "@/observability/logging/logger";

const app = createApp();

app.listen(config.server.port, () => {
  logger.info({
    event: 'server_started',
    port: config.server.port,
    environment: config.server.environment
  })
});
