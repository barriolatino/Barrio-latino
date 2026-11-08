import "server-only";
import { db } from "@/lib/db";
import { flagEmoji } from "@/lib/format";

export async function formOptions() {
  const [cats, countries, brands] = await Promise.all([
    db.category.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true } }),
    db.country.findMany({ orderBy: [{ name: "asc" }] }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  const roots = cats.filter((c) => !c.parentId);
  return {
    categories: roots.flatMap((r) => [
      { id: r.id, label: r.name },
      ...cats.filter((c) => c.parentId === r.id).map((c) => ({ id: c.id, label: `${r.name} › ${c.name}` })),
    ]),
    countries: countries.map((c) => ({ id: c.id, label: `${flagEmoji(c.isoCode)} ${c.name}` })),
    brands: brands.map((b) => b.name),
  };
}
