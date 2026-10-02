import Link from "next/link";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";

export const metadata = { title: "Historique des prix" };

const KIND: Record<string, string> = { price: "Prix", promo: "Promo", case: "Carton" };

export default async function PriceHistoryPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const { q, page: pageStr } = await searchParams;
  const page = Math.max(1, Number(pageStr) || 1);
  const where = q ? { product: { name: { contains: q, mode: "insensitive" as const } } } : {};
  const [rows, total] = await Promise.all([
    db.priceHistory.findMany({ where, orderBy: { changedAt: "desc" }, skip: (page - 1) * 100, take: 100, include: { product: { select: { id: true, name: true, reference: true } } } }),
    db.priceHistory.count({ where }),
  ]);
  return (
    <>
      <AdminHeader title="Historique des prix" intro="Chaque changement de prix est enregistré automatiquement, avec la date et l'auteur." />
      <form className="mb-4">
        <input name="q" defaultValue={q} type="search" placeholder="Filtrer par produit…" className="h-11 w-full max-w-sm rounded-[var(--radius-control)] border border-line-strong bg-white px-3" />
      </form>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-xs uppercase text-ink-muted">
              <tr><th className="py-2">Date</th><th>Produit</th><th>Type</th><th className="text-right">Ancien</th><th className="text-right">Nouveau</th><th className="text-right">Écart</th><th className="pl-4">Par</th></tr>
            </thead>
            <tbody className="tabular">
              {rows.map((h) => {
                const diff = h.oldCents !== null && h.newCents !== null ? h.newCents - h.oldCents : null;
                return (
                  <tr key={h.id} className="border-t border-line">
                    <td className="py-2 whitespace-nowrap">{formatDateTime(h.changedAt)}</td>
                    <td><Link href={`/admin/products/${h.product.id}`} className="font-medium hover:underline">{h.product.name}</Link>{h.product.reference && <span className="ml-1 text-xs text-ink-muted">{h.product.reference}</span>}</td>
                    <td>{KIND[h.kind] ?? h.kind}</td>
                    <td className="text-right text-ink-muted">{h.oldCents !== null ? formatPrice(h.oldCents) : "—"}</td>
                    <td className="text-right font-semibold">{h.newCents !== null ? formatPrice(h.newCents) : "—"}</td>
                    <td className={`text-right ${diff && diff > 0 ? "text-danger" : diff && diff < 0 ? "text-green" : ""}`}>{diff ? `${diff > 0 ? "+" : "−"}${formatPrice(Math.abs(diff))}` : ""}</td>
                    <td className="pl-4 text-ink-muted">{h.changedBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {total > 100 && (
          <p className="mt-4 flex gap-3 text-sm">
            {page > 1 && <Link className="underline" href={{ query: { q, page: page - 1 } }}>← Plus récents</Link>}
            <span className="text-ink-muted">Page {page} / {Math.ceil(total / 100)}</span>
            {page * 100 < total && <Link className="underline" href={{ query: { q, page: page + 1 } }}>Plus anciens →</Link>}
          </p>
        )}
      </Panel>
    </>
  );
}
