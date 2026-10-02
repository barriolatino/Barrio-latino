import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { getSettings } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Mentions légales", robots: { index: false } };

export default async function Page() {
  const s = await getSettings();
  return (
    <div className="container-page max-w-3xl py-6 sm:py-10">
      <PageTitle title="Mentions légales" />
      {s.legalNotice ? (
        <div className="max-w-prose whitespace-pre-line">{s.legalNotice}</div>
      ) : (
        <p className="text-ink-muted">Ce texte sera bientôt publié. Il se renseigne dans Administration › Paramètres.</p>
      )}
    </div>
  );
}
