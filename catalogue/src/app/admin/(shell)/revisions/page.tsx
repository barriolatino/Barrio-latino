import Link from "next/link";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";
import { RestoreButton } from "./restore-button";

export const metadata = { title: "Corbeille et restauration" };

const ACTIONS: Record<string, string> = { update: "Avant modification", delete: "Avant suppression", import: "Avant import" };

export default async function RevisionsPage({ searchParams }: { searchParams: Promise<{ produit?: string }> }) {
  await requireAdmin();
  const { produit } = await searchParams;
  const [revisions, trashed] = await Promise.all([
    db.revision.findMany({ where: { entityType: "Product", ...(produit ? { entityId: produit } : {}) }, orderBy: { createdAt: "desc" }, take: 150 }),
    db.product.count({ where: { deletedAt: { not: null } } }),
  ]);
  return (
    <>
      <AdminHeader
        title="Corbeille et restauration"
        intro={<>Avant chaque modification, l&apos;état précédent du produit est conservé. Restaurer une version la remet en ligne telle qu&apos;elle était (la version actuelle est elle-même sauvegardée).</>}
      />
      <p className="mb-4 text-sm">
        <Link href="/admin/products?statut=corbeille" className="font-semibold text-navy underline underline-offset-4">Voir la corbeille ({trashed} produit{trashed > 1 ? "s" : ""})</Link>
        {produit && <> · <Link href="/admin/revisions" className="underline">Toutes les versions</Link></>}
      </p>
      <Panel>
        {revisions.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucune version enregistrée.</p>
        ) : (
          <ul className="divide-y divide-line">
            {revisions.map((r) => {
              const s = r.snapshot as { name?: string; priceCents?: number; available?: boolean; visibility?: string };
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{s.name ?? r.summary}</p>
                    <p className="text-xs text-ink-muted">
                      {ACTIONS[r.action] ?? r.action} · {formatDateTime(r.createdAt)} · {r.createdBy}
                      {typeof s.priceCents === "number" && <> · prix alors : <span className="tabular">{formatPrice(s.priceCents)}</span></>}
                      {s.visibility === "DRAFT" && " · brouillon"}
                      {s.available === false && " · indisponible"}
                    </p>
                  </div>
                  <RestoreButton id={r.id} />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
