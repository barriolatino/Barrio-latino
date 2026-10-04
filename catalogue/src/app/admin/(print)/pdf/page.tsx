import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { flagEmoji, formatLine, formatPrice, unitMeasurePrice } from "@/lib/format";
import { mediaSrc } from "@/lib/media-url";
import { priceInfo } from "@/lib/pricing";
import { getSettings } from "@/lib/catalogue";
import { PrintButton } from "./print-button";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = { title: "Catalogue PDF", robots: { index: false } };

/** Catalogue imprimable généré depuis la base : A4, 4 produits par ligne, une catégorie par section. */
export default async function PrintCatalogue({ searchParams }: { searchParams: Promise<{ references?: string }> }) {
  await requireAdmin();
  const { references } = await searchParams;
  const showRefs = references !== "0";
  const settings = await getSettings();
  const categories = await db.category.findMany({
    where: { parentId: null },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: { children: { orderBy: [{ displayOrder: "asc" }, { name: "asc" }] } },
  });
  const products = await db.product.findMany({
    where: { visibility: "PUBLISHED", deletedAt: null, ...(settings.unavailableBehavior === "hide" ? { available: true } : {}) },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: { brand: true, country: true, promotions: true, images: { take: 1, orderBy: { position: "asc" }, include: { media: true } } },
  });
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-ink print:p-0">
      <style>{`@page { size: A4; margin: 12mm 10mm; } @media print { body { background: white; } .break { break-before: page; } article { break-inside: avoid; } }`}</style>
      <div className="no-print mb-6 flex items-center justify-between rounded-lg bg-cream p-4">
        <p className="text-sm">Aperçu du catalogue. Choisissez « Enregistrer au format PDF » comme imprimante.</p>
        <PrintButton />
      </div>
      <header className="mb-8 flex items-end justify-between border-b-4 border-navy pb-4">
        <div>
          <p className="font-display text-4xl font-extrabold text-navy">{settings.shopName}</p>
          <p className="text-sm font-semibold uppercase tracking-widest text-coral-text">{settings.shopKicker}</p>
        </div>
        <div className="text-right text-xs text-ink-muted">
          <p className="font-semibold text-ink">Catalogue au {date}</p>
          {settings.address && <p className="whitespace-pre-line">{settings.address}</p>}
          {settings.phone && <p>{settings.phone}</p>}
        </div>
      </header>
      {categories.map((cat, ci) => {
        const ids = [cat.id, ...cat.children.map((c) => c.id)];
        const list = products.filter((p) => ids.includes(p.categoryId));
        if (!list.length) return null;
        return (
          <section key={cat.id} className={ci > 0 ? "break mt-8" : ""}>
            <h2 className="mb-3 rounded bg-navy px-3 py-1.5 font-display text-2xl font-bold text-white">{cat.name}</h2>
            <div className="grid grid-cols-4 gap-3">
              {list.map((p) => {
                const price = priceInfo(p);
                const measure = unitMeasurePrice(price.current, p, settings.currency);
                return (
                  <article key={p.id} className="flex flex-col rounded border border-line p-2 text-center">
                    <div className="relative aspect-square">
                      {p.images[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaSrc(p.images[0].media.key, 400)} alt="" className="absolute inset-0 h-full w-full object-contain" />
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-ink-muted">{[p.brand?.name, p.country && `${flagEmoji(p.country.isoCode)} ${p.country.name}`].filter(Boolean).join(" · ")}</p>
                    <p className="text-xs font-bold leading-tight">{p.name}</p>
                    <p className="text-[10px] text-ink-muted">{[formatLine({ ...p, unitCount: p.packaging ? null : p.unitCount }), p.packaging].filter(Boolean).join(" · ")}</p>
                    <p className="tabular mt-auto pt-1 text-sm font-bold">
                      {price.isPromotion && <span className="mr-1 text-[10px] font-normal text-ink-muted line-through">{formatPrice(price.regular, settings.currency)}</span>}
                      <span className={price.isPromotion ? "text-coral-text" : "text-navy"}>{formatPrice(price.current, settings.currency)}{p.saleUnit === "KG" ? "/kg" : ""}</span>
                    </p>
                    {measure && <p className="tabular text-[9px] text-ink-muted">{measure}</p>}
                    {p.caseQuantity && p.casePriceCents !== null && <p className="tabular text-[9px] text-ink-muted">Carton de {p.caseQuantity} : {formatPrice(p.casePriceCents, settings.currency)}</p>}
                    {showRefs && p.reference && <p className="tabular text-[9px] text-ink-faint">Réf. {p.reference}</p>}
                    {!p.available && <p className="text-[9px] font-semibold uppercase text-danger">Indisponible</p>}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
      <footer className="mt-8 border-t border-line pt-3 text-center text-[10px] text-ink-muted">
        Prix en vigueur au {date}, susceptibles d&apos;évoluer. Catalogue à jour : {SITE_URL}/catalogue
      </footer>
    </div>
  );
}
