// Remplit la base avec des données de démonstration.
// Usage : npm run db:seed   (variables : ADMIN_EMAIL, ADMIN_PASSWORD, SEED_IMAGES_DIR)
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { slugify } from "../src/lib/format";
import { saveProduct } from "../src/lib/products";
import { storeImage } from "../src/lib/storage";
import { productInput } from "../src/lib/validation";
import { categories, countries, products } from "./demo-data";

async function main() {
  // Administrateur
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password && !(await db.adminUser.findUnique({ where: { email } }))) {
    await db.adminUser.create({ data: { email, name: "Administrateur", passwordHash: await hashPassword(password) } });
    console.log(`Compte administrateur créé : ${email}`);
  }

  await db.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      shopName: "Barrio Latino",
      shopKicker: "Épicerie latino-américaine",
      heroTitle: "Les saveurs d'Amérique latine à portée de main.",
      heroText: "Arepas, pulpes de fruits, fromages, épices… Consultez les produits, les formats et les prix, puis commandez par WhatsApp.",
      description: "Épicerie latino-américaine à Clermont-Ferrand.",
      address: "9 rue du Port\n63000 Clermont-Ferrand",
      phone: "09 81 92 40 25",
      whatsapp: "+33 7 63 92 09 98",
      instagram: "barriolatino_fr",
      openingHours: "À compléter dans Administration › Paramètres",
    },
  });

  if ((await db.product.count()) > 0) {
    console.log("Des produits existent déjà : données de démonstration non ajoutées.");
    return;
  }

  for (const [i, [name, isoCode]] of countries.entries()) {
    await db.country.upsert({ where: { isoCode }, update: {}, create: { name, isoCode, slug: slugify(name), displayOrder: i } });
  }

  const catIds = new Map<string, string>();
  for (const [i, c] of categories.entries()) {
    const parent = await db.category.upsert({
      where: { slug: slugify(c.name) },
      update: {},
      create: { name: c.name, slug: slugify(c.name), description: c.description, displayOrder: i * 10 },
    });
    catIds.set(c.name, parent.id);
    for (const [j, child] of (c.children ?? []).entries()) {
      const sub = await db.category.upsert({
        where: { slug: slugify(child) },
        update: {},
        create: { name: child, slug: slugify(child), parentId: parent.id, displayOrder: j * 10 },
      });
      catIds.set(child, sub.id);
    }
  }

  const imagesDir = process.env.SEED_IMAGES_DIR;
  const countryIds = new Map((await db.country.findMany()).map((c) => [c.isoCode, c.id]));

  for (const p of products) {
    let brandId: string | null = null;
    if (p.brand) {
      const brand = await db.brand.upsert({ where: { slug: slugify(p.brand) }, update: {}, create: { name: p.brand, slug: slugify(p.brand) } });
      brandId = brand.id;
    }
    const imageIds: string[] = [];
    const file = imagesDir ? path.join(imagesDir, `${p.ref}.png`) : null;
    if (file && existsSync(file)) {
      const stored = await storeImage(readFileSync(file), slugify(`${p.name} ${p.brand ?? ""}`));
      const media = await db.media.create({ data: { ...stored, name: `${p.name}${p.brand ? ` ${p.brand}` : ""}`, alt: `${p.name}${p.brand ? ` ${p.brand}` : ""}` } });
      imageIds.push(media.id);
    }
    const input = productInput.parse({
      name: p.name,
      reference: p.ref,
      description: p.description ?? "",
      brandId,
      categoryId: catIds.get(p.category),
      countryId: p.country ? countryIds.get(p.country) : null,
      storage: p.storage,
      netWeightG: p.weight ?? null,
      unitCount: p.units ?? null,
      packaging: p.packaging ?? "",
      saleUnit: p.kg ? "KG" : "UNIT",
      priceCents: p.price,
      promoCents: p.promo ?? null,
      caseQuantity: p.case?.[0] ?? null,
      casePriceCents: p.case?.[1] ?? null,
      available: p.available ?? true,
      published: true,
      featured: p.featured ?? false,
      isNew: p.isNew ?? false,
      tags: p.tags ?? "",
    });
    const id = await saveProduct(input, { actor: "démonstration", imageIds, skipRevalidate: true });
    await db.product.update({ where: { id }, data: { isExample: true } });
  }
  console.log(`${products.length} produits de démonstration créés.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
