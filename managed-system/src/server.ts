import "dotenv/config";

import { createApp } from "@/app";
import { config } from "@/config/index";

const app = createApp();

app.listen(config.server.port, () => {
  console.info(
    `Managed system bootstrap prepared for ${config.server.environment} on port ${config.server.port}`,
  );
});
