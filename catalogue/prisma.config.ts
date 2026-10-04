import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` (lancé à l'installation) n'a pas besoin de la base :
// l'adresse n'est exigée que par les migrations (`prisma migrate deploy`).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx --conditions=react-server prisma/seed.ts" },
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL || "" },
});
