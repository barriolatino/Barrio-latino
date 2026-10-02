"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidateCatalogue } from "@/lib/revalidate";
import { hashPassword, verifyPassword } from "@/lib/password";

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

const schema = z.object({
  shopName: z.string().trim().min(1, "Nom de l'épicerie obligatoire").max(80),
  shopKicker: text(80),
  heroTitle: z.string().trim().min(1, "Titre d'accueil obligatoire").max(140),
  heroText: text(400),
  description: text(400),
  phone: text(40),
  whatsapp: text(40).refine((v) => !v || v.replace(/\D/g, "").length >= 9, "Numéro WhatsApp incomplet"),
  whatsappMessage: text(300),
  email: text(120).refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Adresse e-mail invalide"),
  address: text(300),
  mapUrl: text(500).refine((v) => !v || /^https?:\/\//.test(v), "Lien de carte : commencez par https://"),
  openingHours: text(500),
  instagram: text(200),
  facebook: text(200),
  tiktok: text(200),
  currency: z.enum(["EUR", "USD", "CHF", "GBP"]),
  footerText: text(300),
  legalNotice: text(10000),
  privacyPolicy: text(10000),
  unavailableBehavior: z.enum(["show", "hide"]),
  showReferences: z.string().optional().transform((v) => v === "1"),
  logoMediaId: text(40),
});

export async function saveSettingsAction(_: unknown, formData: FormData) {
  const admin = await requireAdmin();
  const raw = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues.map((i) => i.message).join(" · ") };
  const before = await db.siteSettings.findUnique({ where: { id: 1 } });
  if (before) {
    await db.revision.create({ data: { entityType: "SiteSettings", entityId: "1", action: "update", summary: "Paramètres", createdBy: admin.email, snapshot: JSON.parse(JSON.stringify(before)) } });
  }
  await db.siteSettings.upsert({ where: { id: 1 }, update: parsed.data, create: { id: 1, ...parsed.data } });
  revalidateCatalogue();
  return { ok: true as const };
}

export async function changePasswordAction(_: unknown, formData: FormData) {
  const admin = await requireAdmin();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < 10) return { ok: false as const, error: "Le nouveau mot de passe doit faire au moins 10 caractères" };
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
  if (!(await verifyPassword(current, user.passwordHash))) return { ok: false as const, error: "Mot de passe actuel incorrect" };
  await db.adminUser.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(next) } });
  return { ok: true as const };
}
