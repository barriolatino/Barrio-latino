import Link from "next/link";
import { CategoryCard } from "@/components/category-card";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { SectionHeader, btn } from "@/components/ui";
import { ClockIcon, PinIcon, WhatsAppIcon } from "@/components/icons";
import { getCategories, getCounts, getCountries, getSettings, listProducts } from "@/lib/catalogue";
import { whatsappLink } from "@/lib/contact";
import { flagEmoji } from "@/lib/format";

export default async function HomePage() {
  const [settings, categories, countries, counts, featured, promos, news] = await Promise.all([
    getSettings(),
    getCategories(),
    getCountries(),
    getCounts(),
    listProducts({ featured: true, limit: 10 }),
    listProducts({ promo: true, limit: 10 }),
    listProducts({ nouveau: true, tri: "nouveautes", limit: 10 }),
  ]);
  const currency = settings.currency;
  const showRef = settings.showReferences;
  const heroProducts = [...featured.items, ...promos.items].filter((p) => p.image).slice(0, 3);
  const wa = whatsappLink(settings.whatsapp, settings.whatsappMessage);
  const visibleCategories = categories.filter((c) => c.count > 0);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-cream">
        <div className="picado absolute inset-0" aria-hidden />
        <div className="container-page relative grid items-center gap-8 py-8 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
          <div>
            {settings.shopKicker && (
              <p className="mb-4 inline-flex rounded-full bg-navy px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">{settings.shopKicker}</p>
            )}
            <h1 className="max-w-[16ch] text-[2.25rem] font-extrabold sm:text-6xl lg:text-[4.25rem]">{settings.heroTitle}</h1>
            {settings.heroText && <p className="mt-3 max-w-xl text-ink-muted sm:mt-4 sm:text-lg">{settings.heroText}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/catalogue" className={`${btn.base} ${btn.primary} ${btn.lg}`}>
                Voir le catalogue
                <span className="tabular font-normal text-white/70">{counts.total}</span>
              </Link>
              {counts.promotions > 0 && (
                <Link href="/promotions" className={`${btn.base} ${btn.secondary} ${btn.lg}`}>
                  {counts.promotions} promotion{counts.promotions > 1 ? "s" : ""}
                </Link>
              )}
            </div>
          </div>
          {heroProducts.length > 0 && (
            <div className="relative mx-auto hidden aspect-[6/5] w-full max-w-lg sm:block lg:max-w-none" aria-hidden>
              <div className="absolute left-1/2 top-0 aspect-square w-[80%] -translate-x-1/2 rounded-full bg-sun" />
              {heroProducts.map((p, i) => (
                <div
                  key={p.id}
                  className={
                    [
                      "absolute bottom-[4%] left-0 w-[40%] -rotate-6",
                      "absolute bottom-0 left-[27%] z-10 w-[46%]",
                      "absolute bottom-[6%] right-0 w-[40%] rotate-6",
                    ][i]
                  }
                >
                  <ProductImage image={p.image} sizes="320px" priority className="overflow-hidden rounded-2xl border border-line shadow-[0_18px_30px_-14px_rgb(18_23_58/0.45)]" />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Catégories */}
      {visibleCategories.length > 0 && (
        <section className="container-page pt-10 sm:pt-14" aria-labelledby="h-categories">
          <SectionHeader id="h-categories" title="Catégories" href="/categories" />
          <ul
            className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-[repeat(var(--n),minmax(0,1fr))]"
            style={{ "--n": Math.min(visibleCategories.length, 8) } as React.CSSProperties}
          >
            {visibleCategories.map((c) => (
              <li key={c.id} className="w-[42vw] max-w-[180px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <CategoryCard category={c} compact />
              </li>
            ))}
          </ul>
        </section>
      )}

      {promos.items.length > 0 && (
        <section className="container-page pt-12 sm:pt-16" aria-labelledby="h-promos">
          <SectionHeader id="h-promos" kicker="En ce moment" title="Promotions" href="/promotions" />
          <ProductGrid>
            {promos.items.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} currency={currency} showReference={showRef} />)}
          </ProductGrid>
        </section>
      )}

      {featured.items.length > 0 && (
        <section className="container-page pt-12 sm:pt-16" aria-labelledby="h-featured">
          <SectionHeader id="h-featured" title="Nos incontournables" href="/catalogue" />
          <ProductGrid>
            {featured.items.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} currency={currency} showReference={showRef} />)}
          </ProductGrid>
        </section>
      )}

      {news.items.length > 0 && (
        <section className="container-page pt-12 sm:pt-16" aria-labelledby="h-news">
          <SectionHeader id="h-news" kicker="Fraîchement arrivés" title="Nouveautés" href="/nouveautes" />
          <ProductGrid>
            {news.items.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} currency={currency} showReference={showRef} />)}
          </ProductGrid>
        </section>
      )}

      {countries.length > 0 && (
        <section className="container-page pt-12 sm:pt-16" aria-labelledby="h-pays">
          <SectionHeader id="h-pays" title="Voyager par pays" href="/pays" />
          <ul className="flex flex-wrap gap-2">
            {countries.map((c) => (
              <li key={c.id}>
                <Link href={`/pays/${c.slug}`} className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-paper px-4 font-medium text-ink hover:border-navy">
                  <span aria-hidden className="text-lg">{flagEmoji(c.isoCode)}</span>
                  {c.name}
                  <span className="tabular text-sm text-ink-faint">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(settings.address || settings.openingHours || wa) && (
        <section className="container-page pt-12 sm:pt-16" aria-labelledby="h-visite">
          <div className="grid gap-6 rounded-[var(--radius-card)] bg-navy p-6 text-white sm:p-10 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <h2 id="h-visite" className="text-3xl font-extrabold text-white sm:text-4xl">Passez à l&apos;épicerie</h2>
              <p className="mt-2 text-white/80">Une question sur un produit, une commande à préparer ? Écrivez-nous, nous répondons vite.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {wa && (
                  <a href={wa} className={`${btn.base} ${btn.whatsapp} ${btn.lg}`}>
                    <WhatsAppIcon /> Commander sur WhatsApp
                  </a>
                )}
                <Link href="/contact" className={`${btn.base} ${btn.lg} border border-white/30 text-white hover:bg-white/10`}>
                  Adresse et horaires
                </Link>
              </div>
            </div>
            <ul className="space-y-3 text-white/85">
              {settings.address && <li className="flex gap-3"><PinIcon className="mt-0.5 shrink-0" /><span className="whitespace-pre-line">{settings.address}</span></li>}
              {settings.openingHours && <li className="flex gap-3"><ClockIcon className="mt-0.5 shrink-0" /><span className="whitespace-pre-line">{settings.openingHours}</span></li>}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
