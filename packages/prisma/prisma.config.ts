import "dotenv/config";
import { defineConfig } from "prisma/config";

const localDatabaseUrl = "postgresql://postgres:postgres@localhost:5432/offerbot";

export default defineConfig({
  schema: "schema.prisma",
  migrations: {
    path: "migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? localDatabaseUrl,
  },
});
