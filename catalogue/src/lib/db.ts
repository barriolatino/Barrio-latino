import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Adresse de la base nettoyée (espaces, guillemets copiés par erreur). */
function databaseUrl() {
  const raw = (process.env.DATABASE_URL ?? "").trim().replace(/^["']|["']$/g, "").trim();
  if (process.env.VERCEL) {
    let host = "";
    try {
      host = new URL(raw).hostname;
    } catch {
      throw new Error("DATABASE_URL illisible : vérifiez qu'elle commence par postgresql:// et ne contient ni espace ni guillemet");
    }
    if (!host || host === "localhost" || host === "127.0.0.1") {
      throw new Error(`DATABASE_URL pointe vers « ${host || "(vide)"} » au lieu du serveur Supabase (…pooler.supabase.com)`);
    }
  }
  return raw;
}

function createClient() {
  // Peu de connexions par processus : le pooler Supabase limite le nombre de
  // clients, et le build Next.js lance plusieurs processus en parallèle.
  const adapter = new PrismaPg({
    connectionString: databaseUrl(),
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    // Rend vite les connexions inutilisées : sur Vercel, chaque instance garde
    // sinon les siennes ouvertes et le pooler Supabase arrive à saturation.
    idleTimeoutMillis: 5_000,
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
