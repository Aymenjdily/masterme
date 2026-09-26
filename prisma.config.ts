import path from "node:path";
import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, ".env.local") });

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
