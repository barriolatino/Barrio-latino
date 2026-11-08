import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { NamedListManager } from "../named-list-manager";

export const metadata = { title: "Pays" };

export default async function CountriesAdmin() {
  await requireAdmin();
  const countries = await db.country.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <>
      <AdminHeader title="Pays" intro="Seuls les pays qui ont au moins un produit publié apparaissent sur le site." />
      <NamedListManager kind="country" rows={countries.map((c) => ({ id: c.id, name: c.name, isoCode: c.isoCode, count: c._count.products }))} />
    </>
  );
}
