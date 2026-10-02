// Ajoute ou met à jour les produits réels de l'épicerie (prisma/epicerie-data.ts).
// Idempotent : un produit existant (même référence) est mis à jour, avec historique des prix.
// Les produits de démonstration éventuels sont repassés en brouillon (non visibles).
// Usage : npm run db:seed:epicerie
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { slugify } from "../src/lib/format";
import { saveProduct } from "../src/lib/products";
import { storeImage } from "../src/lib/storage";
import { productInput } from "../src/lib/validation";
import { categories, products } from "./epicerie-data";
import { countries } from "./demo-data";

const IMAGES = path.join(__dirname, "images-epicerie");

async function main() {
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
    await saveProduct(input, { id: existing?.id, actor: "liste de produits", imageIds, skipRevalidate: true });
    if (existing) updated++;
    else created++;
  }

  const demos = await db.product.updateMany({ where: { isExample: true, visibility: "PUBLISHED" }, data: { visibility: "DRAFT" } });
  console.log(`${created} produit(s) créé(s), ${updated} mis à jour.`);
  if (demos.count) console.log(`${demos.count} produit(s) de démonstration repassé(s) en brouillon.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
