"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";

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
