// Adresse publique du catalogue. Sur Vercel, sans NEXT_PUBLIC_SITE_URL, on prend
// l'adresse de production fournie automatiquement par la plateforme.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
