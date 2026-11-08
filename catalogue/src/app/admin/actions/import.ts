"use server";

import { requireAdmin } from "@/lib/auth";
import { applyImport, planImport, type PlannedRow } from "@/lib/import";
import { revalidateCatalogue } from "@/lib/revalidate";
import { readSpreadsheet, type ColumnKey, type SheetRow } from "@/lib/spreadsheet";

const MAX_ROWS = 5000;

export type Preview =
  | { ok: true; rows: SheetRow[]; columns: ColumnKey[]; plan: PlannedRow[]; unknownHeaders: string[] }
  | { ok: false; error: string };

/** Étape 1 : lit le fichier et montre ce qui va changer, sans rien enregistrer. */
export async function previewImportAction(formData: FormData): Promise<Preview> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choisissez un fichier .xlsx ou .csv" };
  try {
    const sheet = await readSpreadsheet(file);
    if (!sheet.rows.length) return { ok: false, error: "Le fichier ne contient aucune ligne de produit" };
    if (sheet.rows.length > MAX_ROWS) return { ok: false, error: `${MAX_ROWS} lignes maximum par fichier` };
    if (!sheet.columns.includes("name") && !sheet.columns.includes("reference")) {
      return { ok: false, error: "Il faut au moins une colonne Nom ou Référence" };
    }
    const plan = await planImport(sheet.rows, sheet.columns);
    return { ok: true, rows: sheet.rows, columns: sheet.columns, plan, unknownHeaders: sheet.unknownHeaders };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Fichier illisible" };
  }
}

/** Étape 2 : applique un lot de lignes. Appelée par paquets pour afficher la progression. */
export async function applyImportAction(rows: SheetRow[], columns: ColumnKey[], last: boolean) {
  const admin = await requireAdmin();
  if (rows.length > 100) throw new Error("Lot trop grand");
  const results = await applyImport(rows, columns, admin.email);
  if (last) revalidateCatalogue();
  return results;
}
