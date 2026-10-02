import "server-only";
import ExcelJS from "exceljs";
import { normalize } from "./format";

// Colonnes du modèle d'import / export (ordre du fichier).
export const COLUMNS = [
  { key: "reference", label: "Référence", help: "Facultative mais conseillée : sert à retrouver le produit lors d'une mise à jour." },
  { key: "name", label: "Nom", help: "Obligatoire." },
  { key: "brand", label: "Marque", help: "Créée automatiquement si elle n'existe pas." },
  { key: "description", label: "Description", help: "" },
  { key: "category", label: "Catégorie", help: "Obligatoire. Créée automatiquement si elle n'existe pas." },
  { key: "subcategory", label: "Sous-catégorie", help: "Facultative, rangée dans la catégorie." },
  { key: "country", label: "Pays", help: "Nom (Colombie) ou code (CO)." },
  { key: "storage", label: "Conservation", help: "Épicerie, Frais ou Surgelé." },
  { key: "weight", label: "Poids (g)", help: "En grammes : 500 ; 1 kg = 1000." },
  { key: "volume", label: "Volume (ml)", help: "En millilitres : 330 ; 1 L = 1000." },
  { key: "unitCount", label: "Nombre de pièces", help: "" },
  { key: "packaging", label: "Conditionnement", help: "Ex. Paquet de 5." },
  { key: "saleUnit", label: "Vendu", help: "« unité » ou « kg »." },
  { key: "price", label: "Prix", help: "Obligatoire. Ex. 3,49" },
  { key: "promotionalPrice", label: "Prix promo", help: "Vide = pas de promotion." },
  { key: "caseQuantity", label: "Carton (quantité)", help: "Vente au carton : nombre d'articles." },
  { key: "casePrice", label: "Carton (prix)", help: "Prix du carton entier." },
  { key: "costPrice", label: "Prix d'achat", help: "Privé : jamais affiché sur le site. Sert à suivre la marge." },
  { key: "available", label: "Disponible", help: "oui / non" },
  { key: "published", label: "Publié", help: "oui / non" },
  { key: "featured", label: "Mis en avant", help: "oui / non" },
  { key: "isNew", label: "Nouveauté", help: "oui / non" },
  { key: "isPromotion", label: "En promotion", help: "oui / non (non = retire la promotion)" },
  { key: "image", label: "Image", help: "Nom d'une image de la médiathèque, ou adresse web (https://…)." },
  { key: "tags", label: "Mots-clés", help: "Séparés par des virgules." },
] as const;

export type ColumnKey = (typeof COLUMNS)[number]["key"];
export type SheetRow = Partial<Record<ColumnKey, string>>;

// En-têtes acceptés (anglais du cahier des charges, français, variantes).
const ALIASES: Record<string, ColumnKey> = {};
for (const c of COLUMNS) {
  ALIASES[normalize(c.key)] = c.key;
  ALIASES[normalize(c.label)] = c.key;
}
Object.assign(ALIASES, {
  ref: "reference", nom: "name", produit: "name", marque: "brand", categorie: "category", "sous categorie": "subcategory",
  pays: "country", origine: "country", poids: "weight", "poids g": "weight", volume: "volume", unites: "unitCount", "nombre d unites": "unitCount",
  conditionnement: "packaging", prix: "price", "prix ttc": "price", "prix promotionnel": "promotionalPrice", promo: "promotionalPrice",
  disponible: "available", disponibilite: "available", publie: "published", vedette: "featured", nouveau: "isNew", nouveaute: "isNew",
  promotion: "isPromotion", photo: "image", "mots cles": "tags", tags: "tags", conservation: "storage", "prix carton": "casePrice",
  "quantite carton": "caseQuantity", "prix achat": "costPrice", "prix d achat ht": "costPrice", "cout": "costPrice", "vente": "saleUnit", "unite de vente": "saleUnit",
} as Record<string, ColumnKey>);

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v).replace(".", ",");
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return cellText(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("hyperlink" in v) return String(v.hyperlink);
  }
  return String(v);
}

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export type ParsedSheet = { rows: SheetRow[]; columns: ColumnKey[]; unknownHeaders: string[] };

/** Lit un fichier CSV ou Excel et renvoie des lignes aux clés normalisées. */
export async function readSpreadsheet(file: File): Promise<ParsedSheet> {
  let matrix: string[][];
  if (/\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets.find((w) => w.name !== "Mode d'emploi") ?? wb.worksheets[0];
    matrix = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      const values: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) values.push(cellText(r.getCell(c).value).trim());
      matrix.push(values);
    });
  } else if (/\.xls$/i.test(file.name)) {
    throw new Error("Ancien format Excel (.xls) : enregistrez le fichier au format .xlsx ou .csv");
  } else {
    let text = new TextDecoder("utf-8").decode(await file.arrayBuffer());
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(await file.arrayBuffer());
    matrix = parseCsv(text.replace(/^﻿/, ""));
  }
  const headerIndex = matrix.findIndex((r) => r.some((c) => ALIASES[normalize(c)]));
  if (headerIndex < 0) throw new Error("Ligne d'en-tête introuvable : utilisez le modèle téléchargeable");
  const header = matrix[headerIndex].map((h) => ALIASES[normalize(h)] ?? null);
  const unknownHeaders = matrix[headerIndex].filter((h, i) => h.trim() && !header[i]);
  const rows = matrix
    .slice(headerIndex + 1)
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => {
      const out: SheetRow = {};
      header.forEach((k, i) => {
        if (k) out[k] = (r[i] ?? "").trim();
      });
      return out;
    });
  return { rows, columns: header.filter((k): k is ColumnKey => !!k), unknownHeaders };
}

export async function buildWorkbook(rows: SheetRow[], withGuide: boolean) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Catalogue Barrio Latino";
  const ws = wb.addWorksheet("Produits", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 4) }));
  ws.getColumn("name").width = 32;
  ws.getColumn("description").width = 40;
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12173A" } };
  for (const r of rows) ws.addRow(r);
  if (withGuide) {
    const g = wb.addWorksheet("Mode d'emploi");
    g.columns = [{ header: "Colonne", key: "label", width: 22 }, { header: "Explication", key: "help", width: 90 }];
    g.getRow(1).font = { bold: true };
    g.addRow({ label: "", help: "Une ligne par produit et par format. Seules les colonnes Nom, Catégorie et Prix sont obligatoires." });
    g.addRow({ label: "", help: "Mise à jour : si la référence existe déjà, le produit est modifié. Une colonne absente du fichier n'est pas modifiée." });
    g.addRow({ label: "", help: "Astuce : exportez vos produits, modifiez les prix dans Excel, puis réimportez le fichier." });
    g.addRow({});
    for (const c of COLUMNS) g.addRow({ label: c.label, help: c.help });
  }
  return wb;
}

export function toCsv(rows: SheetRow[]): string {
  const esc = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [COLUMNS.map((c) => c.label).join(";"), ...rows.map((r) => COLUMNS.map((c) => esc(r[c.key] ?? "")).join(";"))];
  return "﻿" + lines.join("\r\n"); // BOM : Excel ouvre l'UTF-8 correctement
}
