import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { buildDatabaseConfig, buildDatabaseConnectionUrl, } from "./src/config/index";
export default defineConfig({
    dialect: "postgresql",
    schema: "./src/infrastructure/database/schema.ts",
    out: "./drizzle",
    dbCredentials: {
        url: buildDatabaseConnectionUrl(buildDatabaseConfig(process.env)),
    },
});
