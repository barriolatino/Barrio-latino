// Prix effectif d'un produit : prix de base, éventuellement remplacé par une promotion active.

export type PromoLike = { promoCents: number; startsAt: Date; endsAt: Date | null; label?: string | null };

export function activePromotion<T extends PromoLike>(promotions: T[] | undefined, now = new Date()): T | null {
  if (!promotions?.length) return null;
  const active = promotions
    .filter((p) => p.startsAt <= now && (!p.endsAt || p.endsAt > now))
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  return active[0] ?? null;
}

export function priceInfo(
  p: { priceCents: number; promotions?: PromoLike[] },
  now = new Date(),
) {
  const promo = activePromotion(p.promotions, now);
  const isPromotion = !!promo && promo.promoCents < p.priceCents;
  const current = isPromotion ? promo!.promoCents : p.priceCents;
  const saving = isPromotion ? p.priceCents - promo!.promoCents : 0;
  const percent = isPromotion ? Math.round((saving / p.priceCents) * 100) : 0;
  return {
    current,
    regular: p.priceCents,
    isPromotion,
    saving,
    percent,
    promoEndsAt: isPromotion ? promo!.endsAt : null,
    promoLabel: isPromotion ? (promo!.label ?? null) : null,
  };
}

export function isNewProduct(p: { isNew: boolean; newUntil: Date | null }, now = new Date()) {
  return p.isNew && (!p.newUntil || p.newUntil > now);
}
