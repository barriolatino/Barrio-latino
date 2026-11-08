import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageTitle } from "@/components/ui";
import { getCountries } from "@/lib/catalogue";
import { flagEmoji } from "@/lib/format";

export const metadata: Metadata = { title: "Produits par pays", alternates: { canonical: "/pays" } };

export default async function PaysPage() {
  const countries = await getCountries();
  return (
    <div className="container-page py-6 sm:py-10">
      <PageTitle title="Produits par pays" intro="Retrouvez les saveurs de chaque pays." />
      {countries.length === 0 ? (
        <EmptyState title="Aucun pays renseigné pour le moment" />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {countries.map((c) => (
            <li key={c.id}>
              <Link href={`/pays/${c.slug}`} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4 hover:border-navy">
                <span aria-hidden className="text-3xl leading-none">{flagEmoji(c.isoCode)}</span>
                <span>
                  <span className="block font-display text-lg font-bold leading-tight text-navy">{c.name}</span>
                  <span className="tabular text-sm text-ink-muted">{c.count} produit{c.count > 1 ? "s" : ""}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
