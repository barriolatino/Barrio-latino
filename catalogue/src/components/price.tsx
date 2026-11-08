import { formatPrice, unitMeasurePrice } from "@/lib/format";
import type { CardProduct } from "@/lib/catalogue";

type PriceProduct = Pick<CardProduct, "price" | "saleUnit" | "netWeightG" | "volumeMl" | "caseQuantity" | "casePriceCents">;

export function Price({ product, currency, size = "card" }: { product: PriceProduct; currency: string; size?: "card" | "page" }) {
  const { price } = product;
  const perUnit = product.saleUnit === "KG" ? " / kg" : "";
  const measure = unitMeasurePrice(price.current, product, currency);
  const big = size === "page";
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={`tabular font-bold ${price.isPromotion ? "text-coral-text" : "text-navy"} ${big ? "text-3xl" : "text-[length:var(--text-price)]"}`}>
          {formatPrice(price.current, currency)}
          {perUnit && <span className={big ? "text-lg" : "text-sm"}>{perUnit}</span>}
        </span>
        {price.isPromotion && (
          <span className={`tabular text-ink-muted line-through ${big ? "text-lg" : "text-sm"}`}>
            <span className="sr-only">au lieu de </span>
            {formatPrice(price.regular, currency)}
          </span>
        )}
      </p>
      {price.isPromotion && (
        <p className={`tabular font-semibold text-coral-text ${big ? "text-base" : "text-xs"}`}>
          Vous économisez {formatPrice(price.saving, currency)}
        </p>
      )}
      {measure && <p className={`tabular text-ink-muted ${big ? "text-sm" : "text-xs"}`}>soit {measure}</p>}
    </div>
  );
}

export function CasePrice({ product, currency }: { product: PriceProduct; currency: string }) {
  if (!product.caseQuantity || product.casePriceCents === null) return null;
  const perItem = Math.round(product.casePriceCents / product.caseQuantity);
  return (
    <p className="tabular text-xs text-ink-muted">
      Carton de {product.caseQuantity} : <span className="font-semibold text-ink">{formatPrice(product.casePriceCents, currency)}</span>
      <span className="whitespace-nowrap"> ({formatPrice(perItem, currency)} l&apos;unité)</span>
    </p>
  );
}
