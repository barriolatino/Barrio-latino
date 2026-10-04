"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { timingSafeEqual } from "node:crypto";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

// Limitation simple des tentatives, par adresse e-mail (mémoire du serveur).
const attempts = new Map<string, { count: number; until: number }>();

export async function loginAction(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  const a = attempts.get(email);
  if (a && a.count >= 5 && a.until > Date.now()) {
    return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }
  const user = await db.adminUser.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    const count = (a && a.until > Date.now() ? a.count : 0) + 1;
    attempts.set(email, { count, until: Date.now() + 10 * 60_000 });
    return { error: "E-mail ou mot de passe incorrect." };
  }
  attempts.delete(email);
  await createSession(user.id);
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

/** Création du tout premier compte administrateur, depuis le navigateur.
 *  Possible une seule fois, et seulement avec le code ADMIN_SETUP_CODE défini sur l'hébergeur. */
export async function setupAdminAction(_: unknown, formData: FormData) {
  const expected = process.env.ADMIN_SETUP_CODE;
  if (!expected) return { error: "Code d'installation non configuré sur l'hébergeur." };
  if ((await db.adminUser.count()) > 0) return { error: "Un compte administrateur existe déjà : connectez-vous." };
  const code = String(formData.get("code") ?? "");
  const a = attempts.get("__setup__");
  if (a && a.count >= 5 && a.until > Date.now()) return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  if (!timingSafeEqualStr(code, expected)) {
    attempts.set("__setup__", { count: (a && a.until > Date.now() ? a.count : 0) + 1, until: Date.now() + 10 * 60_000 });
    return { error: "Code d'installation incorrect." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Adresse e-mail invalide." };
  if (password.length < 10) return { error: "Le mot de passe doit faire au moins 10 caractères." };
  const user = await db.adminUser.create({ data: { email, name: "Administrateur", passwordHash: await hashPassword(password) } });
  await createSession(user.id);
  redirect("/admin");
}

function timingSafeEqualStr(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
