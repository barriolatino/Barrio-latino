import type { MetadataRoute } from "next";
import { getAllSlugs } from "@/lib/catalogue";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const s = await getAllSlugs();
  return [
    ...["", "/catalogue", "/categories", "/promotions", "/nouveautes", "/pays", "/contact"].map((p) => ({ url: `${base}${p}` })),
    ...s.categories.map((c) => ({ url: `${base}/categories/${c.slug}`, lastModified: c.updatedAt })),
    ...s.countries.map((c) => ({ url: `${base}/pays/${c}` })),
    ...s.brands.map((b) => ({ url: `${base}/marques/${b}` })),
    ...s.products.map((p) => ({ url: `${base}/produits/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
