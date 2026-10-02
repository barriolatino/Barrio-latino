import Link from "next/link";
import { AdminHeader, Panel, Stat } from "@/components/admin/ui";
import { btn } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";

export const metadata = { title: "Tableau de bord" };

const ACTIONS: Record<string, string> = { update: "Modifié", delete: "Mis à la corbeille", import: "Import", create: "Créé" };

export default async function Dashboard() {
  await requireAdmin();
  const now = new Date();
  const live = { deletedAt: null };
  const [total, available, unavailable, drafts, promos, news, categories, withoutImage, revisions, prices] = await Promise.all([
    db.product.count({ where: live }),
    db.product.count({ where: { ...live, available: true } }),
    db.product.count({ where: { ...live, available: false } }),
    db.product.count({ where: { ...live, visibility: "DRAFT" } }),
    db.product.count({ where: { ...live, promotions: { some: { startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } } } }),
    db.product.count({ where: { ...live, isNew: true } }),
    db.category.count(),
    db.product.count({ where: { ...live, images: { none: {} } } }),
    db.revision.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.priceHistory.findMany({ orderBy: { changedAt: "desc" }, take: 8, include: { product: { select: { id: true, name: true } } } }),
  ]);
  const examples = await db.product.count({ where: { ...live, isExample: true } });

  return (
    <>
      <AdminHeader
        title="Tableau de bord"
        actions={
          <>
            <Link href="/admin/products" className={`${btn.base} ${btn.secondary} ${btn.md}`}>Modifier les prix</Link>
            <Link href="/admin/products/new" className={`${btn.base} ${btn.primary} ${btn.md}`}>+ Ajouter un produit</Link>
          </>
        }
      />
      {examples > 0 && (
        <p className="mb-6 rounded-[var(--radius-card)] border border-yellow bg-[#fff8e1] p-4 text-sm">
          <strong>{examples} produits de démonstration</strong> (prix fictifs) sont en ligne. Remplacez-les par vos produits via{" "}
          <Link href="/admin/import" className="font-semibold underline">Importer</Link>, ou supprimez-les depuis la liste des produits (filtre « Exemples »).
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Produits" value={total} href="/admin/products" />
        <Stat label="Disponibles" value={available} href="/admin/products?statut=disponible" />
        <Stat label="Indisponibles" value={unavailable} href="/admin/products?statut=indisponible" tone={unavailable ? "danger" : undefined} />
        <Stat label="Brouillons" value={drafts} href="/admin/products?statut=brouillon" />
        <Stat label="En promotion" value={promos} href="/admin/products?statut=promo" tone="promo" />
        <Stat label="Nouveautés" value={news} href="/admin/products?statut=nouveau" />
        <Stat label="Catégories" value={categories} href="/admin/categories" />
        <Stat label="Sans photo" value={withoutImage} href="/admin/products?statut=sans-photo" tone={withoutImage ? "danger" : undefined} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Dernières modifications de prix">
          {prices.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucune modification pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {prices.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <Link href={`/admin/products/${p.product.id}`} className="font-medium hover:underline">{p.product.name}</Link>
                  <span className="tabular text-ink-muted">
                    {p.kind === "promo" ? "Promo " : p.kind === "case" ? "Carton " : ""}
                    {p.oldCents !== null ? formatPrice(p.oldCents) : "—"} → <strong className="text-ink">{p.newCents !== null ? formatPrice(p.newCents) : "aucun"}</strong>
                    <span className="ml-2 text-xs">{formatDateTime(p.changedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/price-history" className="mt-3 inline-block text-sm font-semibold text-navy underline underline-offset-4">Tout l&apos;historique</Link>
        </Panel>
        <Panel title="Dernières modifications">
          {revisions.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucune modification pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {revisions.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span><span className="text-ink-muted">{ACTIONS[r.action] ?? r.action} · </span>{r.summary}</span>
                  <span className="text-xs text-ink-muted">{formatDateTime(r.createdAt)} · {r.createdBy}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/revisions" className="mt-3 inline-block text-sm font-semibold text-navy underline underline-offset-4">Restaurer une version</Link>
        </Panel>
      </div>
    </>
  );
}
