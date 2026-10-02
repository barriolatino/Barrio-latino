import "server-only";
import { db } from "./db";
import { centsToInput, normalize, parsePrice, slugify } from "./format";
import { activePromotion } from "./pricing";
import { saveProduct } from "./products";
import { storeImage } from "./storage";
import { fieldErrors, productInput, type ProductInput } from "./validation";
import type { ColumnKey, SheetRow } from "./spreadsheet";

export type PlannedRow = {
  line: number;
  action: "create" | "update" | "error";
  name: string;
  reference: string | null;
  priceBefore: number | null;
  priceAfter: number | null;
  promoAfter: number | null;
  errors: string[];
  warnings: string[];
};

const YES = ["oui", "o", "yes", "y", "1", "true", "vrai", "x"];
const NO = ["non", "n", "no", "0", "false", "faux"];
const bool = (v: string | undefined) => (v === undefined || v === "" ? undefined : YES.includes(normalize(v)) ? true : NO.includes(normalize(v)) ? false : null);

function storageOf(v: string) {
  const n = normalize(v);
  if (!n) return undefined;
  if (n.startsWith("surg") || n.startsWith("cong") || n === "frozen") return "FROZEN";
  if (n.startsWith("frais") || n.startsWith("refri") || n === "chilled") return "CHILLED";
  if (n.startsWith("epi") || n.startsWith("amb") || n.startsWith("sec") || n === "ambient") return "AMBIENT";
  return null;
}

type Lookups = Awaited<ReturnType<typeof loadLookups>>;

async function loadLookups() {
  const [categories, countries, brands, media] = await Promise.all([
    db.category.findMany(),
    db.country.findMany(),
    db.brand.findMany(),
    db.media.findMany({ select: { id: true, name: true, key: true } }),
  ]);
  return { categories, countries, brands, media };
}

function findCategory(l: Lookups, name: string, parentId: string | null) {
  const n = normalize(name);
  return l.categories.find((c) => normalize(c.name) === n && (parentId === undefined || c.parentId === parentId)) ?? null;
}

function findCountry(l: Lookups, v: string) {
  const n = normalize(v);
  return l.countries.find((c) => normalize(c.name) === n || c.isoCode.toLowerCase() === n || c.slug === slugify(v)) ?? null;
}

function findMedia(l: Lookups, v: string) {
  const n = normalize(v.replace(/\.[a-z0-9]{2,4}$/i, ""));
  return l.media.find((m) => normalize(m.name) === n || m.key === v) ?? null;
}

type Resolved = {
  input: Record<string, unknown>;
  existingId?: string;
  priceBefore: number | null;
  category: { name: string; sub: string | null } | null;
  brandName: string | null | undefined;
  imageRef: string | null;
  warnings: string[];
  errors: string[];
};

/** Fusionne la ligne du fichier avec le produit existant : une colonne absente ne modifie rien. */
async function resolveRow(row: SheetRow, columns: Set<ColumnKey>, l: Lookups): Promise<Resolved> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const has = (k: ColumnKey) => columns.has(k);
  const reference = row.reference?.trim() || null;
  const existing = reference
    ? await db.product.findUnique({ where: { reference }, include: { brand: true, category: true, promotions: true, tags: { include: { tag: true } } } })
    : null;

  const base: Record<string, unknown> = existing
    ? {
        name: existing.name,
        reference: existing.reference ?? "",
        description: existing.description ?? "",
        categoryId: existing.categoryId,
        countryId: existing.countryId ?? "",
        storage: existing.storage,
        netWeightG: existing.netWeightG,
        volumeMl: existing.volumeMl,
        unitCount: existing.unitCount,
        packaging: existing.packaging ?? "",
        saleUnit: existing.saleUnit,
        priceCents: centsToInput(existing.priceCents),
        promoCents: centsToInput(activePromotion(existing.promotions)?.promoCents),
        caseQuantity: existing.caseQuantity,
        casePriceCents: centsToInput(existing.casePriceCents),
        available: existing.available,
        published: existing.visibility === "PUBLISHED",
        featured: existing.featured,
        isNew: existing.isNew,
        tags: existing.tags.map((t) => t.tag.name).join(", "),
        seoTitle: existing.seoTitle ?? "",
        seoDescription: existing.seoDescription ?? "",
      }
    : { available: true, published: true, featured: false, isNew: false, storage: "AMBIENT", saleUnit: "UNIT", tags: "" };

  const input: Record<string, unknown> = { ...base, reference: reference ?? "" };
  if (has("name")) input.name = row.name ?? "";
  if (has("description")) input.description = row.description ?? "";
  if (has("weight")) input.netWeightG = row.weight?.replace(/\s|g$/gi, "") ?? "";
  if (has("volume")) input.volumeMl = row.volume?.replace(/\s|ml$/gi, "") ?? "";
  if (has("unitCount")) input.unitCount = row.unitCount ?? "";
  if (has("packaging")) input.packaging = row.packaging ?? "";
  if (has("price")) input.priceCents = row.price ?? "";
  if (has("caseQuantity")) input.caseQuantity = row.caseQuantity ?? "";
  if (has("casePrice")) input.casePriceCents = row.casePrice ?? "";
  if (has("tags")) input.tags = row.tags ?? "";
  if (has("storage") && row.storage) {
    const s = storageOf(row.storage);
    if (s === null) warnings.push(`Conservation « ${row.storage} » inconnue : Épicerie, Frais ou Surgelé`);
    else if (s) input.storage = s;
  }
  if (has("saleUnit") && row.saleUnit) input.saleUnit = normalize(row.saleUnit).startsWith("k") ? "KG" : "UNIT";
  for (const [col, key] of [["available", "available"], ["published", "published"], ["featured", "featured"], ["isNew", "isNew"]] as const) {
    if (!has(col)) continue;
    const b = bool(row[col]);
    if (b === null) warnings.push(`« ${row[col]} » : oui ou non attendu (colonne ${col})`);
    else if (b !== undefined) input[key] = b;
  }
  // Promotion : le prix promo fait foi ; « En promotion = non » la retire.
  if (has("promotionalPrice")) input.promoCents = row.promotionalPrice ?? "";
  if (has("isPromotion")) {
    const b = bool(row.isPromotion);
    if (b === false) input.promoCents = "";
    if (b === true && !input.promoCents) warnings.push("« En promotion = oui » sans prix promo : ignoré");
  }

  let category: Resolved["category"] = null;
  if (has("category") && row.category) {
    const parent = findCategory(l, row.category, null);
    if (row.subcategory) {
      const sub = parent ? findCategory(l, row.subcategory, parent.id) : null;
      if (sub) input.categoryId = sub.id;
      else category = { name: row.category, sub: row.subcategory };
    } else if (parent) input.categoryId = parent.id;
    else category = { name: row.category, sub: null };
    if (category) {
      warnings.push(`Catégorie « ${[category.name, category.sub].filter(Boolean).join(" › ")} » créée à l'import`);
      input.categoryId = "__new__";
    }
  } else if (!existing) errors.push("Catégorie obligatoire");

  if (has("country")) {
    if (row.country) {
      const c = findCountry(l, row.country);
      if (c) input.countryId = c.id;
      else {
        warnings.push(`Pays « ${row.country} » inconnu : ajoutez-le dans Pays (laissé vide)`);
        input.countryId = "";
      }
    } else input.countryId = "";
  }

  const brandName = has("brand") ? row.brand?.trim() || null : undefined;
  if (brandName && !l.brands.some((b) => b.slug === slugify(brandName))) warnings.push(`Marque « ${brandName} » créée à l'import`);

  let imageRef: string | null = null;
  if (has("image") && row.image) {
    if (/^https?:\/\//i.test(row.image)) imageRef = row.image;
    else if (findMedia(l, row.image)) imageRef = row.image;
    else warnings.push(`Image « ${row.image} » introuvable dans la médiathèque`);
  }

  return { input, existingId: existing?.id, priceBefore: existing?.priceCents ?? null, category, brandName, imageRef, warnings, errors };
}

function validate(r: Resolved) {
  const parsed = productInput.safeParse(r.input);
  if (!parsed.success) return { errors: [...r.errors, ...Object.values(fieldErrors(parsed.error))], data: null };
  return { errors: r.errors, data: parsed.data };
}

export async function planImport(rows: SheetRow[], columns: ColumnKey[]): Promise<PlannedRow[]> {
  const l = await loadLookups();
  const cols = new Set(columns);
  const seenRefs = new Map<string, number>();
  const out: PlannedRow[] = [];
  for (const [i, row] of rows.entries()) {
    const line = i + 2; // ligne 1 = en-têtes
    const r = await resolveRow(row, cols, l);
    const { errors, data } = validate(r);
    if (r.input.reference) {
      const prev = seenRefs.get(String(r.input.reference));
      if (prev) errors.push(`Référence déjà présente ligne ${prev}`);
      else seenRefs.set(String(r.input.reference), line);
    }
    out.push({
      line,
      action: errors.length ? "error" : r.existingId ? "update" : "create",
      name: String(r.input.name ?? ""),
      reference: (r.input.reference as string) || null,
      priceBefore: r.priceBefore,
      priceAfter: data?.priceCents ?? parsePrice(String(r.input.priceCents ?? "")),
      promoAfter: data?.promoCents ?? null,
      errors,
      warnings: r.warnings,
    });
  }
  return out;
}

async function ensureCategory(name: string, sub: string | null) {
  const slug = slugify(name);
  let parent = (await db.category.findFirst({ where: { parentId: null, name: { equals: name, mode: "insensitive" } } })) ?? null;
  if (!parent) {
    const free = (await db.category.findUnique({ where: { slug } })) ? `${slug}-${Date.now().toString(36)}` : slug;
    parent = await db.category.create({ data: { name, slug: free, displayOrder: 1000 } });
  }
  if (!sub) return parent.id;
  let child = await db.category.findFirst({ where: { parentId: parent.id, name: { equals: sub, mode: "insensitive" } } });
  if (!child) {
    const s = slugify(sub);
    const free = (await db.category.findUnique({ where: { slug: s } })) ? `${slugify(`${name} ${sub}`)}` : s;
    child = await db.category.create({ data: { name: sub, slug: free, parentId: parent.id, displayOrder: 1000 } });
  }
  return child.id;
}

async function resolveImage(ref: string, productName: string): Promise<string | null> {
  if (/^https?:\/\//i.test(ref)) {
    const existing = await db.media.findFirst({ where: { name: ref.slice(0, 190) } });
    if (existing) return existing.id;
    const res = await fetch(ref, { signal: AbortSignal.timeout(15000) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) throw new Error("image inaccessible");
    const stored = await storeImage(Buffer.from(await res.arrayBuffer()), slugify(productName));
    const m = await db.media.create({ data: { ...stored, name: ref.slice(0, 190), alt: productName } });
    return m.id;
  }
  const l = await db.media.findMany({ select: { id: true, name: true, key: true } });
  const n = normalize(ref.replace(/\.[a-z0-9]{2,4}$/i, ""));
  return l.find((m) => normalize(m.name) === n || m.key === ref)?.id ?? null;
}

/** Applique un lot de lignes (re-validées côté serveur). */
export async function applyImport(rows: SheetRow[], columns: ColumnKey[], actor: string) {
  const l = await loadLookups();
  const cols = new Set(columns);
  const results: { name: string; ok: boolean; error?: string; warning?: string }[] = [];
  for (const row of rows) {
    const r = await resolveRow(row, cols, l);
    try {
      if (r.category) r.input.categoryId = await ensureCategory(r.category.name, r.category.sub);
      if (r.brandName !== undefined) {
        if (r.brandName) {
          const slug = slugify(r.brandName);
          const brand = (await db.brand.findUnique({ where: { slug } })) ?? (await db.brand.create({ data: { slug, name: r.brandName } }));
          r.input.brandId = brand.id;
        } else r.input.brandId = "";
      } else if (r.existingId) {
        r.input.brandId = (await db.product.findUnique({ where: { id: r.existingId }, select: { brandId: true } }))?.brandId ?? "";
      }
      const { errors, data } = validate(r);
      if (!data || errors.length) {
        results.push({ name: String(r.input.name), ok: false, error: errors.join(" ; ") });
        continue;
      }
      let imageIds: string[] | undefined;
      let warning: string | undefined;
      if (r.imageRef) {
        try {
          const mediaId = await resolveImage(r.imageRef, data.name);
          if (mediaId) {
            const current = r.existingId ? await db.productImage.findMany({ where: { productId: r.existingId }, orderBy: { position: "asc" } }) : [];
            imageIds = [mediaId, ...current.map((c) => c.mediaId).filter((id) => id !== mediaId)];
          }
        } catch {
          warning = "image non récupérée";
        }
      }
      await saveProduct(data as ProductInput, { id: r.existingId, actor: `${actor} (import)`, imageIds, skipRevalidate: true });
      results.push({ name: data.name, ok: true, warning });
    } catch (e) {
      results.push({ name: String(r.input.name), ok: false, error: (e as Error).message });
    }
  }
  return results;
}

/** Lignes d'export, dans le format du modèle d'import (aller-retour Excel). */
export async function exportRows(): Promise<SheetRow[]> {
  const products = await db.product.findMany({
    where: { deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      brand: true,
      country: true,
      category: { include: { parent: true } },
      promotions: true,
      tags: { include: { tag: true } },
      images: { take: 1, orderBy: { position: "asc" }, include: { media: true } },
    },
  });
  const yn = (b: boolean) => (b ? "oui" : "non");
  return products.map((p) => {
    const promo = activePromotion(p.promotions);
    return {
      reference: p.reference ?? "",
      name: p.name,
      brand: p.brand?.name ?? "",
      description: p.description ?? "",
      category: p.category.parent ? p.category.parent.name : p.category.name,
      subcategory: p.category.parent ? p.category.name : "",
      country: p.country?.name ?? "",
      storage: { AMBIENT: "Épicerie", CHILLED: "Frais", FROZEN: "Surgelé" }[p.storage],
      weight: p.netWeightG?.toString() ?? "",
      volume: p.volumeMl?.toString() ?? "",
      unitCount: p.unitCount?.toString() ?? "",
      packaging: p.packaging ?? "",
      saleUnit: p.saleUnit === "KG" ? "kg" : "unité",
      price: centsToInput(p.priceCents),
      promotionalPrice: centsToInput(promo?.promoCents),
      caseQuantity: p.caseQuantity?.toString() ?? "",
      casePrice: centsToInput(p.casePriceCents),
      available: yn(p.available),
      published: yn(p.visibility === "PUBLISHED"),
      featured: yn(p.featured),
      isNew: yn(p.isNew),
      isPromotion: yn(!!promo),
      image: p.images[0]?.media.name ?? "",
      tags: p.tags.map((t) => t.tag.name).join(", "),
    };
  });
}
