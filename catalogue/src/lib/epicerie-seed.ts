import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { db } from "./db";
import { slugify } from "./format";
import { saveProduct } from "./products";
import { storeImage } from "./storage";
import { productInput } from "./validation";
import { categories, products } from "../../prisma/epicerie-data";
import { countries } from "../../prisma/demo-data";

// Charge (ou met à jour) la liste réelle de l'épicerie : prisma/epicerie-data.ts.
// Idempotent : un produit existant (même référence) est mis à jour, avec historique des prix.
// Utilisé par le script `npm run db:seed:epicerie` et par le bouton du tableau de bord.
const IMAGES = path.join(process.cwd(), "prisma", "images-epicerie");

export const EPICERIE_PRODUCT_COUNT = products.length;
export const EPICERIE_REFS = products.map((p) => p.ref);

export async function loadEpicerieProducts(actor = "liste de produits") {
  for (const [i, [name, isoCode]] of countries.entries()) {
    await db.country.upsert({ where: { isoCode }, update: {}, create: { name, isoCode, slug: slugify(name), displayOrder: i } });
  }
  const catIds = new Map<string, string>();
  for (const c of categories) {
    const parent = await db.category.upsert({
      where: { slug: slugify(c.name) },
      update: {},
      create: { name: c.name, slug: slugify(c.name), description: c.description, displayOrder: c.order },
    });
    for (const [j, child] of c.children.entries()) {
      const sub = await db.category.upsert({
        where: { slug: slugify(child) },
        update: {},
        create: { name: child, slug: slugify(child), parentId: parent.id, displayOrder: j * 10 },
      });
      catIds.set(`${c.name}/${child}`, sub.id);
    }
  }
  const countryIds = new Map((await db.country.findMany()).map((c) => [c.isoCode, c.id]));

  let created = 0;
  let updated = 0;
  for (const p of products) {
    const brand = await db.brand.upsert({ where: { slug: slugify(p.brand) }, update: {}, create: { name: p.brand, slug: slugify(p.brand) } });
    const existing = await db.product.findUnique({ where: { reference: p.ref }, include: { images: true } });

    let imageIds: string[] | undefined;
    const file = path.join(IMAGES, `${p.ref}.png`);
    if ((!existing || existing.images.length === 0) && existsSync(file)) {
      const label = `${p.name} ${p.brand}`;
      const stored = await storeImage(readFileSync(file), slugify(label));
      const media = await db.media.create({ data: { ...stored, name: label, alt: label } });
      imageIds = [media.id];
    }

    const input = productInput.parse({
      name: p.name,
      reference: p.ref,
      description: p.description,
      brandId: brand.id,
      categoryId: catIds.get(p.category.join("/")),
      countryId: countryIds.get(p.country) ?? null,
      storage: p.storage ?? "AMBIENT",
      netWeightG: p.weight ?? null,
      volumeMl: p.volume ?? null,
      packaging: p.packaging ?? "",
      saleUnit: "UNIT",
      priceCents: p.price,
      costCents: p.cost ?? null,
      available: existing?.available ?? true,
      published: true,
      featured: existing?.featured ?? false,
      isNew: existing?.isNew ?? false,
      tags: p.tags,
    });
    await saveProduct(input, { id: existing?.id, actor, imageIds, skipRevalidate: true });
    if (existing) updated++;
    else created++;
  }

  const demos = await db.product.updateMany({ where: { isExample: true, visibility: "PUBLISHED" }, data: { visibility: "DRAFT" } });
  return { created, updated, demosHidden: demos.count };

}
