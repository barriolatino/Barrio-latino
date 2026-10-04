import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Version affichée dans l'admin (aide au diagnostic)
    NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
  },
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
