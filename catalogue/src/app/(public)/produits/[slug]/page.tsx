import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { ExampleBadge, NewBadge, PromoBadge, StorageBadge, UnavailableBadge } from "@/components/badges";
import { Gallery } from "@/components/gallery";
import { WhatsAppIcon } from "@/components/icons";
import { CasePrice, Price } from "@/components/price";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { ShareButton } from "@/components/share-button";
import { Breadcrumbs, SectionHeader, btn } from "@/components/ui";
import { getProduct, getSettings } from "@/lib/catalogue";
import { whatsappLink } from "@/lib/contact";
import { STORAGE_LABELS, flagEmoji, formatLine, formatPrice, formatVolume, formatWeight } from "@/lib/format";
import { mediaSrc } from "@/lib/media-url";

type Props = { params: Promise<{ slug: string }> };

// Fiches générées à la première visite puis servies depuis le cache,
// invalidées à chaque modification dans l'administration.
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [p, s] = await Promise.all([getProduct((await params).slug), getSettings()]);
  if (!p) return {};
  const fmt = formatLine(p);
  const description =
    p.seoDescription ??
    [`${p.name}${p.brand ? ` ${p.brand.name}` : ""}${fmt ? `, ${fmt}` : ""}`, `${formatPrice(p.price.current, s.currency)}`, p.description]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 160);
  return {
    title: p.seoTitle ?? [p.name, p.brand?.name, fmt].filter(Boolean).join(" "),
    description,
    alternates: { canonical: `/produits/${p.slug}` },
    openGraph: { type: "website", images: p.image ? [{ url: mediaSrc(p.image.key, 1200), alt: p.image.alt }] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [p, s] = await Promise.all([getProduct(slug), getSettings()]);
  if (!p) notFound();

  const currency = s.currency;
  const fmt = formatLine(p);
  const orderText = `${s.whatsappMessage ?? "Bonjour, je souhaite commander :"}\n• ${p.name}${p.brand ? ` (${p.brand.name})` : ""}${fmt ? `, ${fmt}` : ""}${p.reference ? `, réf. ${p.reference}` : ""}\n${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/produits/${p.slug}`;
  const wa = whatsappLink(s.whatsapp, orderText);

  const specs: [string, React.ReactNode][] = [];
  if (p.brand) specs.push(["Marque", <Link key="b" href={`/marques/${p.brand.slug}`} className="underline underline-offset-4 hover:text-navy">{p.brand.name}</Link>]);
  if (p.netWeightG) specs.push(["Poids net", formatWeight(p.netWeightG)]);
  if (p.volumeMl) specs.push(["Volume", formatVolume(p.volumeMl)]);
  if (p.unitCount) specs.push(["Nombre de pièces", p.unitCount]);
  if (p.packaging) specs.push(["Conditionnement", p.packaging]);
  if (p.caseQuantity) specs.push(["Vente au carton", `${p.caseQuantity} articles`]);
  specs.push(["Conservation", STORAGE_LABELS[p.storage]]);
  if (p.country) specs.push(["Origine", <Link key="c" href={`/pays/${p.country.slug}`} className="underline underline-offset-4 hover:text-navy">{flagEmoji(p.country.isoCode)} {p.country.name}</Link>]);
  specs.push(["Catégorie", <Link key="cat" href={`/categories/${p.category.slug}`} className="underline underline-offset-4 hover:text-navy">{p.category.name}</Link>]);
  if (p.reference && s.showReferences) specs.push(["Référence", <span key="r" className="tabular">{p.reference}</span>]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.reference ?? undefined,
    brand: p.brand ? { "@type": "Brand", name: p.brand.name } : undefined,
    description: p.description ?? undefined,
    image: p.images.map((i) => mediaSrc(i.key, 1200)),
    category: p.category.name,
    countryOfOrigin: p.country?.name,
    offers: {
      "@type": "Offer",
      price: (p.price.current / 100).toFixed(2),
      priceCurrency: currency,
      availability: p.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `/produits/${p.slug}`,
    },
  };

  return (
    <div className="container-page py-4 sm:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="hidden sm:block">
        <Breadcrumbs
          items={[
            { href: "/catalogue", label: "Catalogue" },
            ...(p.parentCategory ? [{ href: `/categories/${p.parentCategory.slug}`, label: p.parentCategory.name }] : []),
            { href: `/categories/${p.category.slug}`, label: p.category.name },
            { label: p.name },
          ]}
        />
      </div>
      <div className="sm:hidden">
        <BackLink />
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10 lg:gap-16">
        <div className="relative">
          <Gallery images={p.images} name={p.name} />
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1">
            <StorageBadge storage={p.storage} />
            {p.isNew && <NewBadge />}
            {p.price.isPromotion && <PromoBadge percent={p.price.percent} />}
          </div>
        </div>

        <div>
          {(p.brand || p.country) && (
            <p className="text-sm font-medium text-ink-muted">
              {p.brand?.name}
              {p.brand && p.country && " · "}
              {p.country && `${flagEmoji(p.country.isoCode)} ${p.country.name}`}
            </p>
          )}
          <h1 className="mt-1 text-[2rem] font-extrabold sm:text-[2.75rem]">{p.name}</h1>
          {(fmt || p.packaging) && <p className="mt-1 text-lg text-ink-muted">{[fmt, p.packaging].filter(Boolean).join(" · ")}</p>}
          {p.isExample && <p className="mt-2"><ExampleBadge /> <span className="text-sm text-ink-muted">Produit et prix fictifs, pour la démonstration.</span></p>}

          <div className="mt-5 rounded-[var(--radius-card)] border border-line bg-cream/60 p-4 sm:p-5">
            <Price product={p} currency={currency} size="page" />
            {p.price.isPromotion && p.price.promoEndsAt && (
              <p className="mt-1 text-sm text-ink-muted">Offre valable jusqu&apos;au {new Date(p.price.promoEndsAt).toLocaleDateString("fr-FR")}</p>
            )}
            <div className="mt-2">
              <CasePrice product={p} currency={currency} />
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm font-medium">
              {p.available ? (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-green" aria-hidden />
                  <span className="text-green">Disponible en magasin</span>
                </>
              ) : (
                <UnavailableBadge />
              )}
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {wa && p.available && (
              <a href={wa} className={`${btn.base} ${btn.whatsapp} ${btn.lg} sm:flex-1`}>
                <WhatsAppIcon /> Commander sur WhatsApp
              </a>
            )}
            <ShareButton title={p.name} text={`${p.name} chez ${s.shopName}`} path={`/produits/${p.slug}`} className={`${btn.base} ${btn.secondary} ${btn.lg}`} />
          </div>

          {p.description && (
            <div className="mt-8">
              <h2 className="text-xl font-bold">Description</h2>
              <p className="mt-2 max-w-prose whitespace-pre-line text-ink">{p.description}</p>
            </div>
          )}

          <div className="mt-8">
            <h2 className="text-xl font-bold">Caractéristiques</h2>
            <dl className="mt-3 divide-y divide-line border-y border-line">
              {specs.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[9.5rem_1fr] gap-3 py-2.5 text-[0.9375rem]">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {p.tags.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Mots-clés">
              {p.tags.map((t) => (
                <li key={t}>
                  <Link href={`/catalogue?q=${encodeURIComponent(t)}`} className="inline-flex h-8 items-center rounded-full bg-cream px-3 text-sm text-ink-muted hover:text-navy">
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {p.related.length > 0 && (
        <section className="mt-14 sm:mt-20" aria-labelledby="h-related">
          <SectionHeader id="h-related" title="Dans la même catégorie" href={`/categories/${p.category.slug}`} />
          <ProductGrid>
            {p.related.slice(0, 5).map((r) => (
              <ProductCard key={r.id} product={r} currency={currency} showReference={s.showReferences} />
            ))}
          </ProductGrid>
        </section>
      )}
    </div>
  );
}
