import "server-only";
import { db } from "./db";
import { normalize, slugify } from "./format";
import { activePromotion } from "./pricing";
import type { ProductInput } from "./validation";
import type { Prisma } from "@/generated/prisma/client";
import { revalidateCatalogue } from "./revalidate";

type Tx = Prisma.TransactionClient;

const snapshotInclude = {
  tags: { include: { tag: true } },
  images: true,
  promotions: true,
} satisfies Prisma.ProductInclude;

/** Garde l'état complet d'un produit avant modification (restaurable depuis l'admin). */
export async function snapshotProduct(tx: Tx, id: string, action: string, actor: string, summary?: string) {
  const current = await tx.product.findUnique({ where: { id }, include: snapshotInclude });
  if (!current) return;
  await tx.revision.create({
    data: {
      entityType: "Product",
      entityId: id,
      action,
      summary: summary ?? current.name,
      createdBy: actor,
      snapshot: JSON.parse(JSON.stringify(current)),
    },
  });
}

export async function refreshSearchText(tx: Tx, ids: string[]) {
  const products = await tx.product.findMany({
    where: { id: { in: ids } },
    include: { brand: true, category: { include: { parent: true } }, country: true, tags: { include: { tag: true } } },
  });
  for (const p of products) {
    const text = normalize(
      [
        p.name,
        p.reference,
        p.brand?.name,
        p.category.name,
        p.category.parent?.name,
        p.country?.name,
        p.packaging,
        p.description,
        ...p.tags.map((t) => t.tag.name),
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (text !== p.searchText) await tx.product.update({ where: { id: p.id }, data: { searchText: text } });
  }
}

async function uniqueSlug(tx: Tx, base: string, excludeId?: string) {
  const root = slugify(base) || "produit";
  let slug = root;
  for (let i = 2; ; i++) {
    const taken = await tx.product.findFirst({ where: { slug, NOT: excludeId ? { id: excludeId } : undefined } });
    if (!taken) return slug;
    slug = `${root}-${i}`;
  }
}

export function productSlugBase(name: string, brand?: string | null, weightG?: number | null) {
  return [name, brand, weightG ? `${weightG}g` : null].filter(Boolean).join(" ");
}

async function syncTags(tx: Tx, productId: string, tagList: string) {
  const names = [...new Set(tagList.split(/[,;]/).map((t) => t.trim()).filter(Boolean))];
  await tx.productTag.deleteMany({ where: { productId } });
  for (const name of names) {
    const slug = slugify(name);
    if (!slug) continue;
    const tag = await tx.tag.upsert({ where: { slug }, update: {}, create: { slug, name } });
    await tx.productTag.create({ data: { productId, tagId: tag.id } });
  }
}

/** Fixe le prix promotionnel « jusqu'à nouvel ordre » (ou l'arrête si null). */
export async function applyPromo(
  tx: Tx,
  productId: string,
  promoCents: number | null,
  actor: string,
  endsAt: Date | null = null,
) {
  const now = new Date();
  const promotions = await tx.promotion.findMany({ where: { productId } });
  const active = activePromotion(promotions, now);
  if ((active?.promoCents ?? null) === promoCents && (active?.endsAt?.getTime() ?? null) === (endsAt?.getTime() ?? null)) return;

  if (active) await tx.promotion.updateMany({ where: { productId, id: active.id }, data: { endsAt: now } });
  if (promoCents !== null) {
    await tx.promotion.create({ data: { productId, promoCents, startsAt: now, endsAt } });
  }
  if ((active?.promoCents ?? null) !== promoCents) {
    await tx.priceHistory.create({
      data: { productId, kind: "promo", oldCents: active?.promoCents ?? null, newCents: promoCents, changedBy: actor },
    });
  }
}

async function recordPrice(tx: Tx, productId: string, kind: string, oldCents: number | null, newCents: number | null, actor: string) {
  if (oldCents === newCents) return;
  await tx.priceHistory.create({ data: { productId, kind, oldCents, newCents, changedBy: actor } });
}

function productData(v: ProductInput) {
  return {
    name: v.name,
    reference: v.reference ?? null,
    description: v.description ?? null,
    brandId: v.brandId ?? null,
    categoryId: v.categoryId,
    countryId: v.countryId ?? null,
    storage: v.storage,
    netWeightG: v.netWeightG,
    volumeMl: v.volumeMl,
    unitCount: v.unitCount,
    packaging: v.packaging ?? null,
    saleUnit: v.saleUnit,
    priceCents: v.priceCents!,
    caseQuantity: v.caseQuantity,
    casePriceCents: v.casePriceCents,
    available: v.available,
    visibility: v.published ? ("PUBLISHED" as const) : ("DRAFT" as const),
    featured: v.featured,
    isNew: v.isNew,
    seoTitle: v.seoTitle ?? null,
    seoDescription: v.seoDescription ?? null,
  };
}

export class DuplicateReferenceError extends Error {}

async function assertReferenceFree(tx: Tx, reference: string | null | undefined, excludeId?: string) {
  if (!reference) return;
  const other = await tx.product.findFirst({ where: { reference, NOT: excludeId ? { id: excludeId } : undefined } });
  if (other) throw new DuplicateReferenceError(`La référence ${reference} est déjà utilisée par « ${other.name} »`);
}

export async function saveProduct(
  v: ProductInput,
  opts: { id?: string; actor: string; imageIds?: string[]; tx?: Tx; skipRevalidate?: boolean },
) {
  const run = async (tx: Tx) => {
    await assertReferenceFree(tx, v.reference, opts.id);
    let id = opts.id;
    if (id) {
      const before = await tx.product.findUniqueOrThrow({ where: { id } });
      await snapshotProduct(tx, id, "update", opts.actor);
      await tx.product.update({
        where: { id },
        data: {
          ...productData(v),
          newUntil: v.isNew && !before.isNew ? null : undefined,
          deletedAt: null,
        },
      });
      await recordPrice(tx, id, "price", before.priceCents, v.priceCents, opts.actor);
      await recordPrice(tx, id, "case", before.casePriceCents, v.casePriceCents, opts.actor);
    } else {
      const brand = v.brandId ? await tx.brand.findUnique({ where: { id: v.brandId } }) : null;
      const slug = await uniqueSlug(tx, productSlugBase(v.name, brand?.name, v.netWeightG));
      const last = await tx.product.aggregate({ _max: { displayOrder: true } });
      const created = await tx.product.create({
        data: { ...productData(v), slug, displayOrder: (last._max.displayOrder ?? 0) + 10 },
      });
      id = created.id;
      await recordPrice(tx, id, "price", null, v.priceCents, opts.actor);
    }
    await applyPromo(tx, id, v.promoCents, opts.actor, v.promoEndsAt ? new Date(v.promoEndsAt) : null);
    await syncTags(tx, id, v.tags);
    if (opts.imageIds) await setProductImages(tx, id, opts.imageIds);
    await refreshSearchText(tx, [id]);
    return id;
  };
  const id = opts.tx ? await run(opts.tx) : await db.$transaction(run, { timeout: 20000 });
  if (!opts.skipRevalidate) revalidateCatalogue();
  return id;
}

export async function setProductImages(tx: Tx, productId: string, mediaIds: string[]) {
  await tx.productImage.deleteMany({ where: { productId } });
  const unique = [...new Set(mediaIds)];
  for (const [position, mediaId] of unique.entries()) {
    await tx.productImage.create({ data: { productId, mediaId, position } });
  }
}

export type QuickField = "price" | "promo" | "casePrice" | "available" | "isNew" | "featured" | "published" | "categoryId";

/** Modification rapide d'un seul champ depuis le tableau d'administration. */
export async function quickUpdate(id: string, field: QuickField, value: number | boolean | string | null, actor: string) {
  await db.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id } });
    await snapshotProduct(tx, id, "update", actor, `${before.name} (${field})`);
    switch (field) {
      case "price": {
        const cents = value as number;
        await tx.product.update({ where: { id }, data: { priceCents: cents } });
        await recordPrice(tx, id, "price", before.priceCents, cents, actor);
        break;
      }
      case "casePrice":
        await tx.product.update({ where: { id }, data: { casePriceCents: value as number | null } });
        await recordPrice(tx, id, "case", before.casePriceCents, value as number | null, actor);
        break;
      case "promo":
        await applyPromo(tx, id, value as number | null, actor);
        break;
      case "available":
        await tx.product.update({ where: { id }, data: { available: value as boolean } });
        break;
      case "isNew":
        await tx.product.update({ where: { id }, data: { isNew: value as boolean, newUntil: null } });
        break;
      case "featured":
        await tx.product.update({ where: { id }, data: { featured: value as boolean } });
        break;
      case "published":
        await tx.product.update({ where: { id }, data: { visibility: value ? "PUBLISHED" : "DRAFT" } });
        break;
      case "categoryId":
        await tx.product.update({ where: { id }, data: { categoryId: value as string } });
        await refreshSearchText(tx, [id]);
        break;
    }
  });
  revalidateCatalogue();
}

export async function duplicateProduct(id: string, actor: string) {
  const newId = await db.$transaction(async (tx) => {
    const p = await tx.product.findUniqueOrThrow({ where: { id }, include: snapshotInclude });
    const slug = await uniqueSlug(tx, `${p.slug}-copie`);
    const copy = await tx.product.create({
      data: {
        slug,
        reference: null, // la référence doit rester unique : à saisir pour le nouveau format
        name: `${p.name} (copie)`,
        description: p.description,
        brandId: p.brandId,
        categoryId: p.categoryId,
        countryId: p.countryId,
        storage: p.storage,
        netWeightG: p.netWeightG,
        volumeMl: p.volumeMl,
        unitCount: p.unitCount,
        packaging: p.packaging,
        saleUnit: p.saleUnit,
        priceCents: p.priceCents,
        caseQuantity: p.caseQuantity,
        casePriceCents: p.casePriceCents,
        available: p.available,
        visibility: "DRAFT", // une copie n'est publiée qu'une fois vérifiée
        featured: false,
        isNew: p.isNew,
        displayOrder: p.displayOrder + 1,
        isExample: p.isExample,
      },
    });
    for (const t of p.tags) await tx.productTag.create({ data: { productId: copy.id, tagId: t.tagId } });
    for (const img of p.images) {
      await tx.productImage.create({ data: { productId: copy.id, mediaId: img.mediaId, position: img.position } });
    }
    await recordPrice(tx, copy.id, "price", null, p.priceCents, actor);
    await refreshSearchText(tx, [copy.id]);
    return copy.id;
  });
  revalidateCatalogue();
  return newId;
}

export async function softDeleteProducts(ids: string[], actor: string) {
  await db.$transaction(async (tx) => {
    for (const id of ids) {
      await snapshotProduct(tx, id, "delete", actor);
      await tx.product.update({ where: { id }, data: { deletedAt: new Date(), visibility: "ARCHIVED" } });
    }
  });
  revalidateCatalogue();
}

/** Restaure un produit dans l'état enregistré par une révision. */
export async function restoreProductRevision(revisionId: string, actor: string) {
  await db.$transaction(async (tx) => {
    const rev = await tx.revision.findUniqueOrThrow({ where: { id: revisionId } });
    if (rev.entityType !== "Product") throw new Error("Seules les révisions de produits sont restaurables ici");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = rev.snapshot as any;
    const exists = await tx.product.findUnique({ where: { id: rev.entityId } });
    if (exists) await snapshotProduct(tx, rev.entityId, "update", actor, `${exists.name} (avant restauration)`);
    const category = await tx.category.findUnique({ where: { id: s.categoryId } });
    if (!category) throw new Error("La catégorie de ce produit n'existe plus : recréez-la d'abord");
    const data = {
      slug: s.slug,
      reference: s.reference,
      name: s.name,
      description: s.description,
      brandId: s.brandId && (await tx.brand.findUnique({ where: { id: s.brandId } })) ? s.brandId : null,
      categoryId: s.categoryId,
      countryId: s.countryId && (await tx.country.findUnique({ where: { id: s.countryId } })) ? s.countryId : null,
      storage: s.storage,
      netWeightG: s.netWeightG,
      volumeMl: s.volumeMl,
      unitCount: s.unitCount,
      packaging: s.packaging,
      saleUnit: s.saleUnit,
      priceCents: s.priceCents,
      caseQuantity: s.caseQuantity,
      casePriceCents: s.casePriceCents,
      available: s.available,
      visibility: s.visibility,
      featured: s.featured,
      isNew: s.isNew,
      newUntil: s.newUntil ? new Date(s.newUntil) : null,
      isExample: s.isExample,
      displayOrder: s.displayOrder,
      seoTitle: s.seoTitle,
      seoDescription: s.seoDescription,
      deletedAt: s.deletedAt ? new Date(s.deletedAt) : null,
    };
    if (s.reference) {
      await tx.product.updateMany({ where: { reference: s.reference, NOT: { id: rev.entityId } }, data: { reference: null } });
    }
    await tx.product.updateMany({ where: { slug: s.slug, NOT: { id: rev.entityId } }, data: { slug: `${s.slug}-${Date.now()}` } });
    if (exists) await tx.product.update({ where: { id: rev.entityId }, data });
    else await tx.product.create({ data: { id: rev.entityId, ...data } });
    if (exists && exists.priceCents !== s.priceCents) {
      await recordPrice(tx, rev.entityId, "price", exists.priceCents, s.priceCents, actor);
    }
    await tx.productTag.deleteMany({ where: { productId: rev.entityId } });
    for (const t of s.tags ?? []) {
      if (await tx.tag.findUnique({ where: { id: t.tagId } })) {
        await tx.productTag.create({ data: { productId: rev.entityId, tagId: t.tagId } });
      }
    }
    await tx.productImage.deleteMany({ where: { productId: rev.entityId } });
    for (const img of s.images ?? []) {
      if (await tx.media.findUnique({ where: { id: img.mediaId } })) {
        await tx.productImage.create({ data: { productId: rev.entityId, mediaId: img.mediaId, position: img.position } });
      }
    }
    await tx.promotion.deleteMany({ where: { productId: rev.entityId } });
    for (const pr of s.promotions ?? []) {
      await tx.promotion.create({
        data: {
          productId: rev.entityId,
          promoCents: pr.promoCents,
          startsAt: new Date(pr.startsAt),
          endsAt: pr.endsAt ? new Date(pr.endsAt) : null,
          label: pr.label,
        },
      });
    }
    await refreshSearchText(tx, [rev.entityId]);
  });
  revalidateCatalogue();
}

/** Réordonne un groupe de produits en réutilisant leurs positions actuelles :
 *  l'ordre des autres produits (autres catégories) n'est pas touché. */
export async function reorderProducts(ids: string[]) {
  const current = await db.product.findMany({ where: { id: { in: ids } }, select: { displayOrder: true } });
  let slots = current.map((p) => p.displayOrder).sort((a, b) => a - b);
  if (new Set(slots).size !== slots.length) {
    const start = slots[0] ?? 0;
    slots = ids.map((_, i) => start + i * 10);
  }
  await db.$transaction(ids.map((id, i) => db.product.update({ where: { id }, data: { displayOrder: slots[i] } })));
  revalidateCatalogue();
}
