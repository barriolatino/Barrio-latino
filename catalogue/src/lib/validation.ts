import { z } from "zod";
import { parsePrice } from "./format";

// Règles communes au formulaire, à l'édition rapide et à l'import.

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const optionalInt = (label: string) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v, ctx) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").trim());
      if (!Number.isInteger(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: `${label} : nombre entier positif attendu` });
        return z.NEVER;
      }
      return n;
    });

export const priceField = (label: string, required: boolean) =>
  z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((v, ctx) => {
    if (v === null || v === undefined || v === "") {
      if (required) ctx.addIssue({ code: "custom", message: `${label} obligatoire` });
      return null;
    }
    const cents = parsePrice(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: `${label} : format invalide (exemple : 4,90)` });
      return z.NEVER;
    }
    if (cents < 0) {
      ctx.addIssue({ code: "custom", message: `${label} : un prix ne peut pas être négatif` });
      return z.NEVER;
    }
    return cents;
  });

const bool = z
  .union([z.boolean(), z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1;
    return ["1", "true", "oui", "yes", "on", "vrai", "x"].includes(String(v ?? "").trim().toLowerCase());
  });

export const productInput = z
  .object({
    name: z.string().trim().min(1, "Nom obligatoire").max(160),
    reference: optionalText,
    description: optionalText,
    brandId: optionalText,
    categoryId: z.string().trim().min(1, "Catégorie obligatoire"),
    countryId: optionalText,
    storage: z.enum(["AMBIENT", "CHILLED", "FROZEN"], { message: "Conservation invalide" }).default("AMBIENT"),
    netWeightG: optionalInt("Poids").optional().transform((v) => v ?? null),
    volumeMl: optionalInt("Volume").optional().transform((v) => v ?? null),
    unitCount: optionalInt("Nombre d'unités").optional().transform((v) => v ?? null),
    packaging: optionalText,
    saleUnit: z.enum(["UNIT", "KG"]).default("UNIT"),
    priceCents: priceField("Prix", true),
    promoCents: priceField("Prix promotionnel", false).optional().transform((v) => v ?? null),
    promoEndsAt: optionalText,
    caseQuantity: optionalInt("Quantité par carton").optional().transform((v) => v ?? null),
    casePriceCents: priceField("Prix du carton", false).optional().transform((v) => v ?? null),
    // Case à cocher décochée = champ absent du formulaire = false.
    available: bool.optional().transform((v) => v ?? false),
    published: bool.optional().transform((v) => v ?? false),
    featured: bool.optional().transform((v) => v ?? false),
    isNew: bool.optional().transform((v) => v ?? false),
    tags: z.string().optional().default(""),
    seoTitle: optionalText,
    seoDescription: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.promoCents !== null && v.priceCents !== null && v.promoCents >= v.priceCents) {
      ctx.addIssue({ code: "custom", path: ["promoCents"], message: "Le prix promotionnel doit être inférieur au prix normal" });
    }
    if ((v.caseQuantity === null) !== (v.casePriceCents === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["caseQuantity"],
        message: "Vente au carton : renseignez à la fois la quantité et le prix du carton",
      });
    }
  });

export type ProductInput = z.output<typeof productInput>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    out[key] ??= issue.message;
  }
  return out;
}
