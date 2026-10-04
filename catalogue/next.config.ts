import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
