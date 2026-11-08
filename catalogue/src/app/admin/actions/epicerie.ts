"use server";

import { requireAdmin } from "@/lib/auth";
import { loadEpicerieProducts } from "@/lib/epicerie-seed";
import { revalidateCatalogue } from "@/lib/revalidate";

export async function loadEpicerieProductsAction(): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  try {
    const r = await loadEpicerieProducts(admin.email);
    revalidateCatalogue();
    return { ok: true, message: `${r.created} produit(s) ajouté(s), ${r.updated} mis à jour` };
  } catch (e) {
    console.error(e);
    return { ok: false, error: `Chargement interrompu : ${(e as Error).message}. Relancez-le, il reprendra là où il s'est arrêté.` };
  }
}
