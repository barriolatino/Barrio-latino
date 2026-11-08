"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePrice, slugify } from "@/lib/format";
import {
  DuplicateReferenceError,
  applyPromo,
  duplicateProduct,
  quickUpdate,
  reorderProducts,
  restoreProductRevision,
  saveProduct,
  snapshotProduct,
  softDeleteProducts,
  refreshSearchText,
  type QuickField,
} from "@/lib/products";
import { revalidateCatalogue } from "@/lib/revalidate";
import { fieldErrors, productInput } from "@/lib/validation";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; fields?: Record<string, string> };

export async function saveProductAction(_: unknown, formData: FormData): Promise<ActionResult & { id?: string }> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "") || undefined;
  const raw: Record<string, string> = Object.fromEntries(
    [...formData.entries()].filter(([k]) => !k.startsWith("$") && k !== "imageIds").map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  );
  // La marque se saisit en texte libre : créée au besoin.
  const brandName = (raw.brandName ?? "").trim();
  delete raw.brandName;
  if (brandName) {
    const slug = slugify(brandName);
    const brand = slug
      ? ((await db.brand.findUnique({ where: { slug } })) ?? (await db.brand.create({ data: { name: brandName, slug } })))
      : null;
    raw.brandId = brand?.id ?? "";
  } else raw.brandId = "";
  const parsed = productInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Certains champs sont à corriger.", fields: fieldErrors(parsed.error) };
  }
  const imageIds = formData.getAll("imageIds").map(String).filter(Boolean);
  let savedId: string;
  try {
    savedId = await saveProduct(parsed.data, { id, actor: admin.email, imageIds });
  } catch (e) {
    if (e instanceof DuplicateReferenceError) return { ok: false, error: e.message, fields: { reference: e.message } };
    throw e;
  }
  if (formData.get("$then") === "new") redirect("/admin/products/new?saved=1");
  redirect(`/admin/products?saved=${savedId}`);
}

export async function quickUpdateAction(id: string, field: QuickField, value: string | boolean | null): Promise<ActionResult> {
  const admin = await requireAdmin();
  const product = await db.product.findUnique({ where: { id }, include: { promotions: true } });
  if (!product) return { ok: false, error: "Produit introuvable" };

  let v: number | boolean | string | null = value;
  if (field === "price" || field === "promo" || field === "casePrice") {
    if (value === null || value === "") {
      if (field === "price") return { ok: false, error: "Le prix est obligatoire" };
      v = null;
    } else {
      const cents = parsePrice(String(value));
      if (cents === null) return { ok: false, error: "Prix invalide (exemple : 4,90)" };
      if (cents < 0) return { ok: false, error: "Un prix ne peut pas être négatif" };
      if (field === "promo" && cents >= product.priceCents) return { ok: false, error: "Le prix promo doit être inférieur au prix normal" };
      if (field === "casePrice" && !product.caseQuantity) return { ok: false, error: "Renseignez d'abord la quantité par carton dans la fiche" };
      v = cents;
    }
  }
  if (field === "categoryId" && !(await db.category.findUnique({ where: { id: String(value) } }))) {
    return { ok: false, error: "Catégorie introuvable" };
  }
  await quickUpdate(id, field, v, admin.email);
  return { ok: true };
}

export async function duplicateProductAction(id: string) {
  const admin = await requireAdmin();
  const newId = await duplicateProduct(id, admin.email);
  redirect(`/admin/products/${newId}?duplicated=1`);
}

export async function deleteProductsAction(ids: string[]): Promise<ActionResult> {
  const admin = await requireAdmin();
  await softDeleteProducts(ids, admin.email);
  return { ok: true, message: `${ids.length} produit${ids.length > 1 ? "s" : ""} mis à la corbeille` };
}

export async function restoreRevisionAction(revisionId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await restoreProductRevision(revisionId, admin.email);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return { ok: true, message: "Produit restauré" };
}

export type BulkOp =
  | { kind: "promoPercent"; percent: number; endsAt?: string | null }
  | { kind: "promoPrice"; price: string; endsAt?: string | null }
  | { kind: "promoEnd" }
  | { kind: "available"; value: boolean }
  | { kind: "published"; value: boolean }
  | { kind: "isNew"; value: boolean }
  | { kind: "featured"; value: boolean }
  | { kind: "category"; categoryId: string };

/** Actions groupées : une seule transaction, une révision par produit. */
export async function bulkAction(ids: string[], op: BulkOp): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ids.length) return { ok: false, error: "Aucun produit sélectionné" };
  const endsAt = "endsAt" in op && op.endsAt ? new Date(`${op.endsAt}T23:59:59`) : null;
  if (op.kind === "promoPercent" && !(op.percent > 0 && op.percent < 100)) return { ok: false, error: "Pourcentage entre 1 et 99" };
  let fixed: number | null = null;
  if (op.kind === "promoPrice") {
    fixed = parsePrice(op.price);
    if (fixed === null || fixed < 0) return { ok: false, error: "Prix promo invalide" };
  }
  if (op.kind === "category" && !(await db.category.findUnique({ where: { id: op.categoryId } }))) {
    return { ok: false, error: "Catégorie introuvable" };
  }
  let skipped = 0;
  await db.$transaction(
    async (tx) => {
      for (const id of ids) {
        const p = await tx.product.findUnique({ where: { id } });
        if (!p) continue;
        await snapshotProduct(tx, id, "update", admin.email, `${p.name} (action groupée)`);
        switch (op.kind) {
          case "promoPercent":
            await applyPromo(tx, id, Math.round((p.priceCents * (100 - op.percent)) / 100), admin.email, endsAt);
            break;
          case "promoPrice":
            if (fixed! >= p.priceCents) {
              skipped++;
              break;
            }
            await applyPromo(tx, id, fixed, admin.email, endsAt);
            break;
          case "promoEnd":
            await applyPromo(tx, id, null, admin.email);
            break;
          case "available":
            await tx.product.update({ where: { id }, data: { available: op.value } });
            break;
          case "published":
            await tx.product.update({ where: { id }, data: { visibility: op.value ? "PUBLISHED" : "DRAFT" } });
            break;
          case "isNew":
            await tx.product.update({ where: { id }, data: { isNew: op.value, newUntil: null } });
            break;
          case "featured":
            await tx.product.update({ where: { id }, data: { featured: op.value } });
            break;
          case "category":
            await tx.product.update({ where: { id }, data: { categoryId: op.categoryId } });
            break;
        }
      }
      if (op.kind === "category") await refreshSearchText(tx, ids);
    },
    { timeout: 60000 },
  );
  revalidateCatalogue();
  const n = ids.length - skipped;
  return {
    ok: true,
    message: `${n} produit${n > 1 ? "s" : ""} modifié${n > 1 ? "s" : ""}${skipped ? ` (${skipped} ignoré${skipped > 1 ? "s" : ""} : prix promo supérieur au prix normal)` : ""}`,
  };
}

export async function reorderProductsAction(ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  await reorderProducts(ids);
  return { ok: true, message: "Ordre enregistré" };
}

/** Sort un produit de la corbeille dans l'état où il était avant suppression. */
export async function restoreDeletedAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const rev = await db.revision.findFirst({ where: { entityType: "Product", entityId: id, action: "delete" }, orderBy: { createdAt: "desc" } });
  try {
    if (rev) await restoreProductRevision(rev.id, admin.email);
    else {
      await db.product.update({ where: { id }, data: { deletedAt: null, visibility: "DRAFT" } });
      revalidateCatalogue();
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return { ok: true };
}
