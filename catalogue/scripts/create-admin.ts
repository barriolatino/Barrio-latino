// Crée (ou réinitialise) un compte administrateur.
// Usage : ADMIN_EMAIL=moi@exemple.fr ADMIN_PASSWORD='…' npm run admin:create
import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 10) {
    throw new Error("ADMIN_EMAIL et ADMIN_PASSWORD (10 caractères minimum) sont requis");
  }
  const passwordHash = await hashPassword(password);
  await db.adminUser.upsert({ where: { email }, update: { passwordHash }, create: { email, name: "Administrateur", passwordHash } });
  console.log(`Compte administrateur prêt : ${email}`);
}

main().finally(() => db.$disconnect());
