import Link from "next/link";
import type { CardProduct } from "@/lib/catalogue";
import { flagEmoji, formatLine } from "@/lib/format";
import { ProductImage } from "./product-image";
import { ExampleBadge, NewBadge, PromoBadge, StorageBadge, UnavailableBadge } from "./badges";
import { CasePrice, Price } from "./price";

export function ProductCard({
  product,
  currency,
  showReference,
  priority = false,
}: {
  product: CardProduct;
  currency: string;
  showReference: boolean;
  priority?: boolean;
}) {
  // Le conditionnement (« Paquet de 5 ») remplace le nombre de pièces s'il est renseigné.
  const format = formatLine({ ...product, unitCount: product.packaging ? null : product.unitCount });
  const details = [format, product.packaging].filter(Boolean).join(" · ");
  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-[0_6px_20px_-12px_rgb(18_23_58/0.35)] ${product.available ? "" : "opacity-75"}`}
    >
      <div className="relative">
        <ProductImage
          image={product.image}
          sizes="(min-width: 1440px) 260px, (min-width: 1024px) 23vw, (min-width: 768px) 31vw, 46vw"
          priority={priority}
        />
        <div className="absolute inset-x-2 top-2 flex flex-wrap items-start justify-between gap-1">
          <div className="flex flex-wrap gap-1">
            <StorageBadge storage={product.storage} />
            {product.isNew && <NewBadge />}
          </div>
          {product.price.isPromotion && <PromoBadge percent={product.price.percent} />}
        </div>
        {!product.available && (
          <div className="absolute inset-x-2 bottom-2">
            <UnavailableBadge />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        {(product.brand || product.country) && (
          <p className="truncate text-xs font-medium text-ink-muted">
            {product.brand?.name}
            {product.brand && product.country && " · "}
            {product.country && (
              <span>
                <span aria-hidden>{flagEmoji(product.country.isoCode)} </span>
                {product.country.name}
              </span>
            )}
          </p>
        )}
        <h3 className="line-clamp-2 font-sans text-[0.9375rem] font-semibold leading-snug text-ink sm:text-base">
          <Link href={`/produits/${product.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        {details && <p className="text-sm text-ink-muted">{details}</p>}
        <div className="mt-auto pt-2">
          <Price product={product} currency={currency} />
          <CasePrice product={product} currency={currency} />
          <div className="mt-1 flex items-center justify-between gap-2">
            {showReference && product.reference ? (
              <p className="tabular text-[0.6875rem] text-ink-faint">Réf. {product.reference}</p>
            ) : (
              <span />
            )}
            {product.isExample && <ExampleBadge />}
          </div>
        </div>
      </div>
      {/* Anneau de focus visible sur toute la carte */}
      <span className="pointer-events-none absolute inset-0 rounded-[var(--radius-card)] ring-sun group-has-[a:focus-visible]:ring-3" />
    </article>
  );
}

export function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 min-[1536px]:grid-cols-5">{children}</div>
  );
}
