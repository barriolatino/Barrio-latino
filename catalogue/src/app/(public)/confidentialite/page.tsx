import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { getSettings } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Politique de confidentialité", robots: { index: false } };

export default async function Page() {
  const s = await getSettings();
  return (
    <div className="container-page max-w-3xl py-6 sm:py-10">
      <PageTitle title="Politique de confidentialité" />
      {s.privacyPolicy ? (
        <div className="max-w-prose whitespace-pre-line">{s.privacyPolicy}</div>
      ) : (
        <p className="text-ink-muted">Ce texte sera bientôt publié. Il se renseigne dans Administration › Paramètres.</p>
      )}
    </div>
  );
}
