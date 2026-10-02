import Link from "next/link";
import { AdminHeader } from "@/components/admin/ui";
import { btn } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalize } from "@/lib/format";
import { activePromotion } from "@/lib/pricing";
import type { Prisma } from "@/generated/prisma/client";
import { ProductsTable, type AdminRow } from "./products-table";
import { ProductFilters } from "./product-filters";

export const metadata = { title: "Produits" };

const PER_PAGE = 100;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const now = new Date();
  const and: Prisma.ProductWhereInput[] = [];
  and.push(sp.statut === "corbeille" ? { deletedAt: { not: null } } : { deletedAt: null });
  const tokens = sp.q ? normalize(sp.q).split(" ").filter(Boolean) : [];
  for (const t of tokens) and.push({ searchText: { contains: t } });
  if (sp.categorie) {
    const cat = await db.category.findUnique({ where: { id: sp.categorie }, include: { children: true } });
    and.push({ categoryId: { in: cat ? [cat.id, ...cat.children.map((c) => c.id)] : [] } });
  }
  const activePromo = { startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
  switch (sp.statut) {
    case "disponible": and.push({ available: true }); break;
    case "indisponible": and.push({ available: false }); break;
    case "brouillon": and.push({ visibility: "DRAFT" }); break;
    case "promo": and.push({ promotions: { some: activePromo } }); break;
    case "nouveau": and.push({ isNew: true }); break;
    case "vedette": and.push({ featured: true }); break;
    case "sans-photo": and.push({ images: { none: {} } }); break;
    case "exemples": and.push({ isExample: true }); break;
  }
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sp.tri === "nom" ? [{ name: "asc" }] : sp.tri === "prix" ? [{ priceCents: "asc" }] : sp.tri === "maj" ? [{ updatedAt: "desc" }] : [{ displayOrder: "asc" }, { name: "asc" }];
  const page = Math.max(1, Number(sp.page) || 1);
  const where = { AND: and };
  const [products, total, categories] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        brand: { select: { name: true } },
        category: { select: { id: true, name: true } },
        images: { take: 1, orderBy: { position: "asc" }, include: { media: { select: { key: true } } } },
        promotions: true,
      },
    }),
    db.product.count({ where }),
    db.category.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true } }),
  ]);

  const rows: AdminRow[] = products.map((p) => {
    const promo = activePromotion(p.promotions, now);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand?.name ?? null,
      reference: p.reference,
      categoryId: p.category.id,
      priceCents: p.priceCents,
      promoCents: promo?.promoCents ?? null,
      promoEndsAt: promo?.endsAt?.toISOString() ?? null,
      casePriceCents: p.casePriceCents,
      caseQuantity: p.caseQuantity,
      saleUnit: p.saleUnit,
      available: p.available,
      published: p.visibility === "PUBLISHED",
      isNew: p.isNew,
      featured: p.featured,
      isExample: p.isExample,
      deleted: !!p.deletedAt,
      imageKey: p.images[0]?.media.key ?? null,
    };
  });

  // Catégories à plat, sous-catégories indentées
  const roots = categories.filter((c) => !c.parentId);
  const catOptions = roots.flatMap((r) => [
    { id: r.id, label: r.name },
    ...categories.filter((c) => c.parentId === r.id).map((c) => ({ id: c.id, label: `— ${c.name}` })),
  ]);
  const canReorder = !!sp.categorie && !sp.q && !sp.statut && (!sp.tri || sp.tri === "ordre") && total <= PER_PAGE;

  return (
    <>
      <AdminHeader
        title="Produits"
        intro={<>Cliquez sur un prix pour le modifier, puis appuyez sur Entrée. Cochez plusieurs produits pour les modifier ensemble.</>}
        actions={<Link href="/admin/products/new" className={`${btn.base} ${btn.primary} ${btn.md}`}>+ Ajouter un produit</Link>}
      />
      <ProductFilters categories={catOptions} />
      <ProductsTable
        key={JSON.stringify(sp)}
        rows={rows}
        categories={catOptions}
        total={total}
        canReorder={canReorder}
        trash={sp.statut === "corbeille"}
        savedId={sp.saved ?? null}
      />
      {total > PER_PAGE && (
        <nav className="mt-6 flex items-center justify-center gap-3 text-sm" aria-label="Pages">
          {page > 1 && <Link className={`${btn.base} ${btn.secondary} ${btn.sm}`} href={{ query: { ...sp, page: page - 1 } }}>← Précédents</Link>}
          <span className="tabular text-ink-muted">Page {page} sur {Math.ceil(total / PER_PAGE)}</span>
          {page * PER_PAGE < total && <Link className={`${btn.base} ${btn.secondary} ${btn.sm}`} href={{ query: { ...sp, page: page + 1 } }}>Suivants →</Link>}
        </nav>
      )}
    </>
  );
}
