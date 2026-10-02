"use server";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/format";
import { removeImage, storeImage } from "@/lib/storage";
import { revalidateCatalogue } from "@/lib/revalidate";

export type MediaItem = { id: string; key: string; name: string; alt: string | null; width: number; height: number; usages?: number };

const MAX_BYTES = 15 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/heic", "image/heif"];

export async function uploadMediaAction(formData: FormData): Promise<{ ok: true; items: MediaItem[] } | { ok: false; error: string }> {
  await requireAdmin();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, error: "Aucun fichier reçu" };
  const items: MediaItem[] = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) return { ok: false, error: `${file.name} dépasse 15 Mo` };
    if (file.type && !TYPES.includes(file.type)) return { ok: false, error: `${file.name} : format non pris en charge (JPEG, PNG, WebP…)` };
    const base = file.name.replace(/\.[a-z0-9]+$/i, "");
    try {
      const stored = await storeImage(Buffer.from(await file.arrayBuffer()), slugify(base));
      const m = await db.media.create({ data: { ...stored, name: base, alt: null } });
      items.push({ id: m.id, key: m.key, name: m.name, alt: m.alt, width: m.width, height: m.height });
    } catch {
      return { ok: false, error: `${file.name} : image illisible` };
    }
  }
  return { ok: true, items };
}

export async function searchMediaAction(q: string): Promise<MediaItem[]> {
  await requireAdmin();
  const rows = await db.media.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { alt: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 120,
    include: { _count: { select: { usages: true } } },
  });
  return rows.map((m) => ({ id: m.id, key: m.key, name: m.name, alt: m.alt, width: m.width, height: m.height, usages: m._count.usages }));
}

/** Remplace le fichier d'une image : tous les produits qui l'utilisent sont mis à jour. */
export async function replaceMediaAction(id: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Aucun fichier" };
  if (file.size > MAX_BYTES) return { ok: false, error: "Fichier trop lourd (15 Mo max)" };
  const media = await db.media.findUniqueOrThrow({ where: { id } });
  const stored = await storeImage(Buffer.from(await file.arrayBuffer()), slugify(media.name));
  await db.media.update({ where: { id }, data: stored });
  await removeImage(media.key);
  revalidateCatalogue();
  return { ok: true };
}

export async function updateMediaAction(id: string, data: { name: string; alt: string }) {
  await requireAdmin();
  await db.media.update({ where: { id }, data: { name: data.name.trim() || "image", alt: data.alt.trim() || null } });
  revalidateCatalogue();
  return { ok: true };
}

export async function deleteMediaAction(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const media = await db.media.findUniqueOrThrow({ where: { id }, include: { _count: { select: { usages: true } } } });
  if (media._count.usages > 0) return { ok: false, error: `Image utilisée par ${media._count.usages} produit(s) : retirez-la d'abord des fiches` };
  await db.category.updateMany({ where: { imageId: id }, data: { imageId: null } });
  await db.media.delete({ where: { id } });
  await removeImage(media.key);
  revalidateCatalogue();
  return { ok: true };
}
