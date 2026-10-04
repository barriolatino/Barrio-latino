import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSettings } from "@/lib/catalogue";

// Pages rendues à la demande (données en cache, invalidées par l'admin) :
// le build n'interroge pas la base, ce qui évite de saturer ses connexions.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const description = s.description ?? `${s.shopName} : épicerie latino-américaine. Consultez le catalogue, les prix et les promotions.`;
  return {
    title: { default: `${s.shopName} · ${s.shopKicker ?? "Épicerie"}`, template: `%s · ${s.shopName}` },
    description,
    openGraph: { siteName: s.shopName, locale: "fr_FR", type: "website" },
  };
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
