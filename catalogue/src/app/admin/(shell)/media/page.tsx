import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { MediaManager } from "./media-manager";

export const metadata = { title: "Médiathèque" };

export default async function MediaAdmin() {
  await requireAdmin();
  const media = await db.media.findMany({
    orderBy: { createdAt: "desc" },
    include: { usages: { include: { product: { select: { id: true, name: true } } } } },
  });
  return (
    <>
      <AdminHeader title="Médiathèque" intro="Toutes les photos. Une même photo peut servir à plusieurs produits ; la remplacer met à jour tous ces produits d'un coup." />
      <MediaManager
        items={media.map((m) => ({
          id: m.id,
          key: m.key,
          name: m.name,
          alt: m.alt,
          width: m.width,
          height: m.height,
          products: m.usages.map((u) => ({ id: u.product.id, name: u.product.name })),
        }))}
      />
    </>
  );
}
