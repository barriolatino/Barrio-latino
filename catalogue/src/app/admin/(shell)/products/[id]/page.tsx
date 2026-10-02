import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { btn } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { centsToInput, formatDateTime, formatPrice } from "@/lib/format";
import { activePromotion } from "@/lib/pricing";
import { duplicateProductAction } from "../../../actions/products";
import { formOptions } from "../form-data";
import { ProductForm } from "../product-form";
import { SavedToast } from "../saved-toast";

export const metadata = { title: "Modifier un produit" };

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ duplicated?: string }> }) {
  await requireAdmin();
  const [{ id }, { duplicated }] = await Promise.all([params, searchParams]);
  const [p, opts, history] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: { brand: true, tags: { include: { tag: true } }, images: { orderBy: { position: "asc" }, include: { media: true } }, promotions: true },
    }),
    formOptions(),
    db.priceHistory.findMany({ where: { productId: id }, orderBy: { changedAt: "desc" }, take: 20 }),
  ]);
  if (!p) notFound();
  const promo = activePromotion(p.promotions);

  return (
    <>
      {duplicated && <SavedToast text="Copie créée en brouillon : ajustez le format, le prix et la référence." />}
      <AdminHeader
        title={p.name}
        intro={p.deletedAt ? "Ce produit est dans la corbeille." : p.visibility === "DRAFT" ? "Brouillon : non visible sur le site." : undefined}
        actions={
          <>
            <a href={`/produits/${p.slug}`} target="_blank" className={`${btn.base} ${btn.secondary} ${btn.sm}`}>Voir sur le site ↗</a>
            <form action={duplicateProductAction.bind(null, p.id)}>
              <button className={`${btn.base} ${btn.secondary} ${btn.sm}`}>Dupliquer (autre format)</button>
            </form>
          </>
        }
      />
      <ProductForm
        {...opts}
        values={{
          id: p.id,
          name: p.name,
          brandName: p.brand?.name ?? "",
          reference: p.reference ?? "",
          description: p.description ?? "",
          categoryId: p.categoryId,
          countryId: p.countryId ?? "",
          storage: p.storage,
          netWeightG: str(p.netWeightG),
          volumeMl: str(p.volumeMl),
          unitCount: str(p.unitCount),
          packaging: p.packaging ?? "",
          saleUnit: p.saleUnit,
          price: centsToInput(p.priceCents),
          promo: centsToInput(promo?.promoCents),
          promoEndsAt: promo?.endsAt ? promo.endsAt.toISOString().slice(0, 10) : "",
          caseQuantity: str(p.caseQuantity),
          casePrice: centsToInput(p.casePriceCents),
          cost: centsToInput(p.costCents),
          available: p.available,
          published: p.visibility === "PUBLISHED",
          isNew: p.isNew,
          featured: p.featured,
          tags: p.tags.map((t) => t.tag.name).join(", "),
          seoTitle: p.seoTitle ?? "",
          seoDescription: p.seoDescription ?? "",
          images: p.images.map((i) => ({ id: i.media.id, key: i.media.key, name: i.media.name, alt: i.media.alt, width: i.media.width, height: i.media.height })),
        }}
      />
      <Panel title="Historique des prix de ce produit" className="mt-6">
        {history.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun changement enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-ink-muted">
              <tr><th className="py-1 font-medium">Date</th><th className="font-medium">Prix</th><th className="font-medium">Ancien</th><th className="font-medium">Nouveau</th><th className="font-medium">Par</th></tr>
            </thead>
            <tbody className="tabular">
              {history.map((h) => (
                <tr key={h.id} className="border-t border-line">
                  <td className="py-1.5">{formatDateTime(h.changedAt)}</td>
                  <td>{h.kind === "promo" ? "Promo" : h.kind === "case" ? "Carton" : "Normal"}</td>
                  <td>{h.oldCents !== null ? formatPrice(h.oldCents) : "—"}</td>
                  <td className="font-semibold">{h.newCents !== null ? formatPrice(h.newCents) : "—"}</td>
                  <td className="text-ink-muted">{h.changedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Link href={`/admin/revisions?produit=${p.id}`} className="mt-3 inline-block text-sm font-semibold text-navy underline underline-offset-4">Versions précédentes de la fiche</Link>
      </Panel>
    </>
  );
}
