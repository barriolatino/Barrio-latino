import type { MetadataRoute } from "next";
import { getAllSlugs } from "@/lib/catalogue";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;
  const s = await getAllSlugs();
  return [
    ...["", "/catalogue", "/categories", "/promotions", "/nouveautes", "/pays", "/contact"].map((p) => ({ url: `${base}${p}` })),
    ...s.categories.map((c) => ({ url: `${base}/categories/${c.slug}`, lastModified: c.updatedAt })),
    ...s.countries.map((c) => ({ url: `${base}/pays/${c}` })),
    ...s.brands.map((b) => ({ url: `${base}/marques/${b}` })),
    ...s.products.map((p) => ({ url: `${base}/produits/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
