import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { normalize } from "./format";
import { isNewProduct, priceInfo } from "./pricing";
import { CATALOGUE_TAG } from "./revalidate";
import type { Prisma } from "@/generated/prisma/client";

// Lecture publique du catalogue. Les résultats sont mis en cache et invalidés
// à chaque modification depuis l'administration (voir revalidate.ts).

const cacheOpts = { tags: [CATALOGUE_TAG], revalidate: 3600 }; // 1 h : fin des promotions datées

export const PAGE_SIZE = 48;

/** Mot-clé qui déclenche la mention sanitaire obligatoire pour les boissons alcoolisées. */
export const ALCOHOL_TAG = "alcool";

const cardInclude = {
  brand: { select: { name: true, slug: true } },
  country: { select: { name: true, slug: true, isoCode: true } },
  category: { select: { name: true, slug: true } },
  images: { orderBy: { position: "asc" }, take: 1, include: { media: true } },
  promotions: true,
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export type ImageDTO = { key: string; width: number; height: number; blurData: string | null; alt: string };

function toImage(m: { key: string; width: number; height: number; blurData: string | null; alt: string | null } | undefined, fallbackAlt: string): ImageDTO | null {
  return m ? { key: m.key, width: m.width, height: m.height, blurData: m.blurData, alt: m.alt || fallbackAlt } : null;
}

function toCard(p: CardRow) {
  const price = priceInfo(p);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    reference: p.reference,
    brand: p.brand,
    country: p.country,
    category: p.category,
    storage: p.storage,
    netWeightG: p.netWeightG,
    volumeMl: p.volumeMl,
    unitCount: p.unitCount,
    packaging: p.packaging,
    saleUnit: p.saleUnit,
    caseQuantity: p.caseQuantity,
    casePriceCents: p.casePriceCents,
    available: p.available,
    featured: p.featured,
    isExample: p.isExample,
    isNew: isNewProduct(p),
    price: { ...price, promoEndsAt: price.promoEndsAt?.toISOString() ?? null },
    image: toImage(p.images[0]?.media, [p.name, p.brand?.name].filter(Boolean).join(" ")),
  };
}

export type CardProduct = ReturnType<typeof toCard>;

export const getSettings = unstable_cache(
  async () => {
    // Lecture seule : la ligne est créée par la migration (pas d'écriture pendant le rendu).
    const s =
      (await db.siteSettings.findUnique({ where: { id: 1 } })) ??
      (await db.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }));
    const logo = s.logoMediaId ? await db.media.findUnique({ where: { id: s.logoMediaId } }) : null;
    return { ...s, updatedAt: s.updatedAt.toISOString(), logoKey: logo?.key ?? null };
  },
  ["settings"],
  cacheOpts,
);

export type Settings = Awaited<ReturnType<typeof getSettings>>;

async function publicWhere(): Promise<Prisma.ProductWhereInput> {
  const settings = await getSettings();
  return {
    visibility: "PUBLISHED",
    deletedAt: null,
    ...(settings.unavailableBehavior === "hide" ? { available: true } : {}),
  };
}

function activePromoWhere(now: Date): Prisma.PromotionWhereInput {
  return { startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
}

export type ProductFilters = {
  q?: string;
  categorie?: string;
  pays?: string;
  marque?: string;
  conservation?: string;
  promo?: boolean;
  nouveau?: boolean;
  dispo?: boolean;
  min?: number;
  max?: number;
  tri?: string;
  page?: number;
  featured?: boolean;
  limit?: number;
};

const SORTS: Record<string, Prisma.ProductOrderByWithRelationInput[]> = {
  recommande: [{ featured: "desc" }, { displayOrder: "asc" }, { name: "asc" }],
  "prix-asc": [{ priceCents: "asc" }, { name: "asc" }],
  "prix-desc": [{ priceCents: "desc" }, { name: "asc" }],
  "nom-asc": [{ name: "asc" }],
  "nom-desc": [{ name: "desc" }],
  nouveautes: [{ isNew: "desc" }, { createdAt: "desc" }],
};

async function buildWhere(f: ProductFilters, now: Date) {
  const and: Prisma.ProductWhereInput[] = [await publicWhere()];
  if (f.categorie) {
    const cat = await db.category.findUnique({ where: { slug: f.categorie }, include: { children: true } });
    and.push({ categoryId: { in: cat ? [cat.id, ...cat.children.map((c) => c.id)] : [] } });
  }
  if (f.pays) and.push({ country: { slug: f.pays } });
  if (f.marque) and.push({ brand: { slug: f.marque } });
  if (f.conservation && ["AMBIENT", "CHILLED", "FROZEN"].includes(f.conservation)) {
    and.push({ storage: f.conservation as "AMBIENT" | "CHILLED" | "FROZEN" });
  }
  if (f.promo) and.push({ promotions: { some: activePromoWhere(now) } });
  if (f.nouveau) and.push({ isNew: true, OR: [{ newUntil: null }, { newUntil: { gt: now } }] });
  if (f.dispo) and.push({ available: true });
  if (f.featured) and.push({ featured: true });
  if (f.min !== undefined) and.push({ priceCents: { gte: f.min } });
  if (f.max !== undefined) and.push({ priceCents: { lte: f.max } });
  return and;
}

async function queryProducts(f: ProductFilters) {
  const now = new Date();
  const and = await buildWhere(f, now);
  const tokens = f.q ? normalize(f.q).split(" ").filter(Boolean).slice(0, 6) : [];
  const where: Prisma.ProductWhereInput = { AND: [...and, ...tokens.map((t) => ({ searchText: { contains: t } }))] };
  const take = f.limit ?? PAGE_SIZE * Math.max(1, f.page ?? 1);
  const orderBy = SORTS[f.tri ?? "recommande"] ?? SORTS.recommande;

  let [rows, total] = await Promise.all([
    db.product.findMany({ where, include: cardInclude, orderBy, take }),
    db.product.count({ where }),
  ]);
  let approximate = false;

  // Aucun résultat exact : on tente une recherche tolérante aux fautes de frappe.
  if (total === 0 && tokens.length) {
    const q = tokens.join(" ");
    const hits = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Product"
      WHERE word_similarity(${q}, "searchText") > 0.45
      ORDER BY word_similarity(${q}, "searchText") DESC
      LIMIT 60`;
    if (hits.length) {
      const fuzzyWhere = { AND: [...and, { id: { in: hits.map((h) => h.id) } }] };
      [rows, total] = await Promise.all([
        db.product.findMany({ where: fuzzyWhere, include: cardInclude, orderBy, take }),
        db.product.count({ where: fuzzyWhere }),
      ]);
      approximate = total > 0;
    }
  }

  // Le tri par prix tient compte des promotions en cours.
  const items = rows.map(toCard);
  if (f.tri === "prix-asc") items.sort((a, b) => a.price.current - b.price.current);
  if (f.tri === "prix-desc") items.sort((a, b) => b.price.current - a.price.current);
  return { items, total, approximate };
}

export const listProducts = unstable_cache(queryProducts, ["listProducts"], cacheOpts);

export const getCategories = unstable_cache(
  async () => {
    const where = await publicWhere();
    const cats = await db.category.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: { image: true, _count: { select: { products: { where } } } },
    });
    // Image de repli : la photo du premier produit de la catégorie.
    const firstImages = await db.product.findMany({
      where: { ...where, images: { some: {} } },
      distinct: ["categoryId"],
      orderBy: [{ featured: "desc" }, { displayOrder: "asc" }],
      select: { categoryId: true, images: { take: 1, orderBy: { position: "asc" }, include: { media: true } } },
    });
    const fallback = new Map(firstImages.map((p) => [p.categoryId, p.images[0]?.media]));
    const all = cats.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      parentId: c.parentId,
      ownCount: c._count.products,
      image: toImage(c.image ?? fallback.get(c.id) ?? undefined, c.name),
    }));
    const roots = all
      .filter((c) => !c.parentId)
      .map((c) => {
        const children = all.filter((x) => x.parentId === c.id);
        return {
          ...c,
          image: c.image ?? children.find((x) => x.image)?.image ?? null,
          children,
          count: c.ownCount + children.reduce((n, x) => n + x.ownCount, 0),
        };
      });
    return roots;
  },
  ["categories"],
  cacheOpts,
);

export type CategoryNode = Awaited<ReturnType<typeof getCategories>>[number];

export const getCountries = unstable_cache(
  async () => {
    const where = await publicWhere();
    const rows = await db.country.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: { where } } } },
    });
    return rows.filter((c) => c._count.products > 0).map((c) => ({ id: c.id, slug: c.slug, name: c.name, isoCode: c.isoCode, count: c._count.products }));
  },
  ["countries"],
  cacheOpts,
);

export const getBrands = unstable_cache(
  async () => {
    const where = await publicWhere();
    const rows = await db.brand.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: { where } } } } });
    return rows.filter((b) => b._count.products > 0).map((b) => ({ slug: b.slug, name: b.name, count: b._count.products }));
  },
  ["brands"],
  cacheOpts,
);

export const getCounts = unstable_cache(
  async () => {
    const now = new Date();
    const where = await publicWhere();
    const [promotions, nouveautes, total, alcohol] = await Promise.all([
      db.product.count({ where: { ...where, promotions: { some: activePromoWhere(now) } } }),
      db.product.count({ where: { ...where, isNew: true, OR: [{ newUntil: null }, { newUntil: { gt: now } }] } }),
      db.product.count({ where }),
      db.product.count({ where: { ...where, tags: { some: { tag: { slug: ALCOHOL_TAG } } } } }),
    ]);
    return { promotions, nouveautes, total, alcohol };
  },
  ["counts"],
  cacheOpts,
);

export const getProduct = unstable_cache(
  async (slug: string) => {
    const where = await publicWhere();
    const p = await db.product.findFirst({
      where: { ...where, slug },
      include: {
        ...cardInclude,
        category: { select: { name: true, slug: true, parent: { select: { name: true, slug: true } } } },
        images: { orderBy: { position: "asc" }, include: { media: true } },
        tags: { include: { tag: true } },
      },
    });
    if (!p) return null;
    const card = toCard({ ...p, images: p.images.slice(0, 1) } as CardRow);
    const related = await db.product.findMany({
      where: { ...where, categoryId: p.categoryId, NOT: { id: p.id } },
      include: cardInclude,
      orderBy: [{ featured: "desc" }, { displayOrder: "asc" }],
      take: 8,
    });
    return {
      ...card,
      description: p.description,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      updatedAt: p.updatedAt.toISOString(),
      parentCategory: p.category.parent,
      tags: p.tags.map((t) => t.tag.name),
      images: p.images.map((i) => toImage(i.media, p.name)!),
      related: related.map(toCard),
    };
  },
  ["product"],
  cacheOpts,
);

export const getAllSlugs = unstable_cache(
  async () => {
    const where = await publicWhere();
    const [products, categories, countries, brands] = await Promise.all([
      db.product.findMany({ where, select: { slug: true, updatedAt: true } }),
      db.category.findMany({ select: { slug: true, updatedAt: true } }),
      db.country.findMany({ where: { products: { some: where } }, select: { slug: true } }),
      db.brand.findMany({ where: { products: { some: where } }, select: { slug: true } }),
    ]);
    return {
      products: products.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt.toISOString() })),
      categories: categories.map((c) => ({ slug: c.slug, updatedAt: c.updatedAt.toISOString() })),
      countries: countries.map((c) => c.slug),
      brands: brands.map((b) => b.slug),
    };
  },
  ["slugs"],
  cacheOpts,
);
