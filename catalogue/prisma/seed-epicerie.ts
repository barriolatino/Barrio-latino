// Ajoute ou met à jour les produits réels de l'épicerie (prisma/epicerie-data.ts).
// Usage : npm run db:seed:epicerie
import "dotenv/config";
import { db } from "../src/lib/db";
import { loadEpicerieProducts } from "../src/lib/epicerie-seed";

loadEpicerieProducts()
  .then(async (r) => {
    console.log(`${r.created} produit(s) créé(s), ${r.updated} mis à jour.`);
    if (r.demosHidden) console.log(`${r.demosHidden} produit(s) de démonstration repassé(s) en brouillon.`);
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
