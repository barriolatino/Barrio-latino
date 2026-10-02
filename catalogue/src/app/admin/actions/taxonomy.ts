"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/format";
import { refreshSearchText } from "@/lib/products";
import { revalidateCatalogue } from "@/lib/revalidate";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function uniqueSlug(model: "category" | "brand" | "country", name: string, excludeId?: string) {
  const root = slugify(name) || "element";
  let slug = root;
  for (let i = 2; ; i++) {
    const where = { slug, NOT: excludeId ? { id: excludeId } : undefined };
    const taken =
      model === "category" ? await db.category.findFirst({ where }) : model === "brand" ? await db.brand.findFirst({ where }) : await db.country.findFirst({ where });
    if (!taken) return slug;
    slug = `${root}-${i}`;
  }
}

async function refreshProducts(where: { categoryId?: { in: string[] }; brandId?: string; countryId?: string }) {
  const ids = (await db.product.findMany({ where, select: { id: true } })).map((p) => p.id);
  if (ids.length) await db.$transaction((tx) => refreshSearchText(tx, ids), { timeout: 60000 });
}

const categorySchema = z.object({
  name: z.string().trim().min(1, "Nom obligatoire").max(80),
  description: z.string().trim().max(300).optional().default(""),
  parentId: z.string().optional().default(""),
  imageId: z.string().optional().default(""),
});

export async function saveCategoryAction(id: string | null, input: z.input<typeof categorySchema>): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const parentId = v.parentId || null;
  if (parentId) {
    const parent = await db.category.findUnique({ where: { id: parentId } });
    if (!parent) return { ok: false, error: "Catégorie parente introuvable" };
    if (parent.parentId) return { ok: false, error: "Deux niveaux maximum : choisissez une catégorie principale comme parent" };
    if (id && parentId === id) return { ok: false, error: "Une catégorie ne peut pas être sa propre parente" };
    if (id && (await db.category.count({ where: { parentId: id } })) > 0) {
      return { ok: false, error: "Cette catégorie a des sous-catégories : elle doit rester principale" };
    }
  }
  const data = { name: v.name, description: v.description || null, parentId, imageId: v.imageId || null };
  if (id) {
    const before = await db.category.findUniqueOrThrow({ where: { id } });
    await db.revision.create({ data: { entityType: "Category", entityId: id, action: "update", summary: before.name, createdBy: admin.email, snapshot: JSON.parse(JSON.stringify(before)) } });
    await db.category.update({ where: { id }, data: { ...data, slug: before.name !== v.name ? await uniqueSlug("category", v.name, id) : undefined } });
    if (before.name !== v.name) {
      const children = await db.category.findMany({ where: { parentId: id }, select: { id: true } });
      await refreshProducts({ categoryId: { in: [id, ...children.map((c) => c.id)] } });
    }
  } else {
    const last = await db.category.aggregate({ where: { parentId }, _max: { displayOrder: true } });
    await db.category.create({ data: { ...data, slug: await uniqueSlug("category", v.name), displayOrder: (last._max.displayOrder ?? 0) + 10 } });
  }
  revalidateCatalogue();
  return { ok: true, message: id ? "Catégorie enregistrée" : "Catégorie créée" };
}

export async function deleteCategoryAction(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const c = await db.category.findUniqueOrThrow({ where: { id }, include: { _count: { select: { products: { where: { deletedAt: null } }, children: true } } } });
  if (c._count.children) return { ok: false, error: "Supprimez ou déplacez d'abord ses sous-catégories" };
  if (c._count.products) return { ok: false, error: `Elle contient ${c._count.products} produit(s) : déplacez-les d'abord vers une autre catégorie` };
  const trashed = await db.product.count({ where: { categoryId: id } });
  if (trashed) return { ok: false, error: "Des produits de la corbeille y sont rattachés : videz-la ou déplacez-les" };
  await db.revision.create({ data: { entityType: "Category", entityId: id, action: "delete", summary: c.name, createdBy: admin.email, snapshot: JSON.parse(JSON.stringify(c)) } });
  await db.category.delete({ where: { id } });
  revalidateCatalogue();
  return { ok: true, message: "Catégorie supprimée" };
}

/** Nouvel ordre d'un groupe de catégories sœurs. */
export async function reorderCategoriesAction(ids: string[]): Promise<Result> {
  await requireAdmin();
  await db.$transaction(ids.map((id, i) => db.category.update({ where: { id }, data: { displayOrder: (i + 1) * 10 } })));
  revalidateCatalogue();
  return { ok: true, message: "Ordre enregistré" };
}

export async function saveBrandAction(id: string | null, name: string): Promise<Result> {
  await requireAdmin();
  const n = name.trim();
  if (!n) return { ok: false, error: "Nom obligatoire" };
  const clash = await db.brand.findFirst({ where: { name: { equals: n, mode: "insensitive" }, NOT: id ? { id } : undefined } });
  if (clash) return { ok: false, error: "Cette marque existe déjà" };
  if (id) {
    await db.brand.update({ where: { id }, data: { name: n, slug: await uniqueSlug("brand", n, id) } });
    await refreshProducts({ brandId: id });
  } else await db.brand.create({ data: { name: n, slug: await uniqueSlug("brand", n) } });
  revalidateCatalogue();
  return { ok: true, message: "Marque enregistrée" };
}

/** Fusionne une marque dans une autre (doublons « Goya » / « GOYA »). */
export async function mergeBrandAction(fromId: string, intoId: string): Promise<Result> {
  await requireAdmin();
  if (fromId === intoId) return { ok: false, error: "Choisissez une autre marque" };
  await db.product.updateMany({ where: { brandId: fromId }, data: { brandId: intoId } });
  await db.brand.delete({ where: { id: fromId } });
  await refreshProducts({ brandId: intoId });
  revalidateCatalogue();
  return { ok: true, message: "Marques fusionnées" };
}

export async function deleteBrandAction(id: string): Promise<Result> {
  await requireAdmin();
  const n = await db.product.count({ where: { brandId: id } });
  if (n) return { ok: false, error: `Utilisée par ${n} produit(s). Fusionnez-la plutôt avec une autre marque.` };
  await db.brand.delete({ where: { id } });
  revalidateCatalogue();
  return { ok: true, message: "Marque supprimée" };
}

export async function saveCountryAction(id: string | null, input: { name: string; isoCode: string }): Promise<Result> {
  await requireAdmin();
  const name = input.name.trim();
  const iso = input.isoCode.trim().toUpperCase();
  if (!name) return { ok: false, error: "Nom obligatoire" };
  if (!/^[A-Z]{2}$/.test(iso)) return { ok: false, error: "Code pays sur 2 lettres (ex. CO, PE, MX)" };
  const clash = await db.country.findFirst({ where: { isoCode: iso, NOT: id ? { id } : undefined } });
  if (clash) return { ok: false, error: `Le code ${iso} est déjà utilisé par ${clash.name}` };
  if (id) {
    await db.country.update({ where: { id }, data: { name, isoCode: iso, slug: await uniqueSlug("country", name, id) } });
    await refreshProducts({ countryId: id });
  } else await db.country.create({ data: { name, isoCode: iso, slug: await uniqueSlug("country", name) } });
  revalidateCatalogue();
  return { ok: true, message: "Pays enregistré" };
}

export async function deleteCountryAction(id: string): Promise<Result> {
  await requireAdmin();
  const n = await db.product.count({ where: { countryId: id } });
  if (n) return { ok: false, error: `Utilisé par ${n} produit(s)` };
  await db.country.delete({ where: { id } });
  revalidateCatalogue();
  return { ok: true, message: "Pays supprimé" };
}
