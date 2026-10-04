import type { NextConfig } from "next";

// Adresse publique des photos : déduite de SUPABASE_URL si elle n'est pas fournie.
const envValue = (name: string) => (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "").trim();
const supabaseUrl = envValue("SUPABASE_URL").replace(/\/+$/, "");
const mediaBase =
  envValue("NEXT_PUBLIC_MEDIA_BASE_URL").replace(/\/+$/, "") ||
  (supabaseUrl && envValue("STORAGE_DRIVER").toLowerCase() !== "local"
    ? `${supabaseUrl}/storage/v1/object/public/${envValue("SUPABASE_BUCKET") || "media"}`
    : "/uploads");

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_MEDIA_BASE_URL: mediaBase },
  experimental: {
    // Les photos sont réduites dans le navigateur avant l'envoi (≈ 1 Mo) ;
    // la marge couvre les envois de plusieurs photos à la fois.
    serverActions: { bodySizeLimit: "8mb" },
  },
  images: { unoptimized: true },
  // Photos de la liste de produits, lues par le bouton « Charger mes produits ».
  outputFileTracingIncludes: { "/admin": ["./prisma/images-epicerie/**/*"] },
  poweredByHeader: false,
};

export default nextConfig;
