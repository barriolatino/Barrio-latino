import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { NamedListManager } from "../named-list-manager";

export const metadata = { title: "Marques" };

export default async function BrandsAdmin() {
  await requireAdmin();
  const brands = await db.brand.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <>
      <AdminHeader title="Marques" intro="Les marques sont aussi créées automatiquement quand vous les tapez dans une fiche produit ou un import. Fusionnez les doublons ici." />
      <NamedListManager kind="brand" rows={brands.map((b) => ({ id: b.id, name: b.name, count: b._count.products }))} />
    </>
  );
}
