import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { CategoriesManager, type CatRow } from "./categories-manager";

export const metadata = { title: "Catégories" };

export default async function CategoriesAdmin() {
  await requireAdmin();
  const cats = await db.category.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: { image: true, _count: { select: { products: { where: { deletedAt: null } } } } },
  });
  const rows: CatRow[] = cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? "",
    parentId: c.parentId,
    count: c._count.products,
    image: c.image ? { id: c.image.id, key: c.image.key, name: c.image.name, alt: c.image.alt, width: c.image.width, height: c.image.height } : null,
  }));
  return (
    <>
      <AdminHeader
        title="Catégories"
        intro="Glissez-déposez (ou utilisez les flèches) pour changer l'ordre d'affichage sur le site. Sans image choisie, la photo d'un produit de la catégorie est utilisée."
      />
      <CategoriesManager rows={rows} />
    </>
  );
}
