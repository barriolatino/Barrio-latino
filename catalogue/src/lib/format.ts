// Fonctions d'affichage. Aucune valeur métier ici : tout arrive en paramètre.

const priceFormatters = new Map<string, Intl.NumberFormat>();

export function formatPrice(cents: number, currency = "EUR"): string {
  let f = priceFormatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("fr-FR", { style: "currency", currency });
    priceFormatters.set(currency, f);
  }
  return f.format(cents / 100);
}

/** « 4,90 » ou « 4,90 € » → 490. Renvoie null si la saisie n'est pas un prix valide. */
export function parsePrice(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  const cleaned = input.replace(/[€\s ]/g, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

/** 490 → « 4,90 » (pour les champs de saisie). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${kg.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;
  }
  return `${grams} g`;
}

export function formatVolume(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} L`;
  if (ml >= 100 && ml % 10 === 0) return `${ml / 10} cl`;
  return `${ml} ml`;
}

/** Prix à l'unité de mesure (€/kg ou €/L), calculé, jamais saisi. */
export function unitMeasurePrice(
  cents: number,
  p: { netWeightG?: number | null; volumeMl?: number | null; saleUnit?: string },
  currency = "EUR",
): string | null {
  if (p.saleUnit === "KG") return null; // le prix affiché est déjà au kilo
  if (p.netWeightG && p.netWeightG > 0) {
    return `${formatPrice(Math.round((cents * 1000) / p.netWeightG), currency)}/kg`;
  }
  if (p.volumeMl && p.volumeMl > 0) {
    return `${formatPrice(Math.round((cents * 1000) / p.volumeMl), currency)}/L`;
  }
  return null;
}

export function flagEmoji(isoCode: string): string {
  if (!/^[A-Za-z]{2}$/.test(isoCode)) return "";
  return String.fromCodePoint(...[...isoCode.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Minuscules, sans accents : « Maracuyá » → « maracuya ». */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

export function slugify(text: string): string {
  return normalize(text).replace(/ñ/g, "n").replace(/\s+/g, "-").slice(0, 80).replace(/-+$/, "");
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export const STORAGE_LABELS = { AMBIENT: "Épicerie", CHILLED: "Frais", FROZEN: "Surgelé" } as const;

/** « 500 g », « 1 L », « Au kilo » : le format affiché sous le nom. */
export function formatLine(p: {
  netWeightG?: number | null;
  volumeMl?: number | null;
  unitCount?: number | null;
  saleUnit?: string;
}): string {
  const parts: string[] = [];
  if (p.saleUnit === "KG") parts.push("Au poids");
  else if (p.netWeightG) parts.push(formatWeight(p.netWeightG));
  if (p.volumeMl) parts.push(formatVolume(p.volumeMl));
  if (p.unitCount && p.unitCount > 1) parts.push(`${p.unitCount} pièces`);
  return parts.join(" · ");
}
