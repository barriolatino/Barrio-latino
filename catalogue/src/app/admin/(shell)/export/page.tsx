import Link from "next/link";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { btn } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { SITE_URL } from "@/lib/site-url";

export const metadata = { title: "Exporter" };

export default async function ExportPage() {
  await requireAdmin();
  const h = await headers();
  const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL ? SITE_URL : undefined) ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const target = `${site}/catalogue`;
  const svg = await QRCode.toString(target, { type: "svg", margin: 1, color: { dark: "#12173A", light: "#FFFFFF" } });
  return (
    <>
      <AdminHeader title="Exporter · PDF · QR code" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Données des produits">
          <p className="mb-4 text-sm text-ink-muted">Le fichier exporté a le même format que le modèle d&apos;import : modifiez les prix dans Excel puis réimportez-le.</p>
          <div className="flex flex-wrap gap-2">
            <a href="/admin/export/produits.xlsx" className={`${btn.base} ${btn.primary} ${btn.md}`}>Exporter en Excel</a>
            <a href="/admin/export/produits.csv" className={`${btn.base} ${btn.secondary} ${btn.md}`}>Exporter en CSV</a>
            <Link href="/admin/import" className={`${btn.base} ${btn.ghost} ${btn.md}`}>Importer un fichier →</Link>
          </div>
        </Panel>
        <Panel title="Catalogue PDF">
          <p className="mb-4 text-sm text-ink-muted">Généré automatiquement à partir des produits publiés, avec les prix actuels. Dans la fenêtre d&apos;impression, choisissez « Enregistrer au format PDF ».</p>
          <div className="flex flex-wrap gap-2">
            <a href="/admin/pdf" target="_blank" className={`${btn.base} ${btn.primary} ${btn.md}`}>Générer le PDF</a>
            <a href="/admin/pdf?references=0" target="_blank" className={`${btn.base} ${btn.secondary} ${btn.md}`}>Sans les références</a>
          </div>
        </Panel>
        <Panel title="QR code du catalogue" className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-6">
            <div className="w-44 rounded-lg border border-line bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} aria-label={`QR code vers ${target}`} role="img" />
            <div className="text-sm">
              <p>Renvoie vers <strong className="break-all">{target}</strong></p>
              <p className="mt-1 text-ink-muted">À imprimer pour la caisse, les flyers, les cartes de visite, les emballages ou Instagram.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href="/admin/export/qr.png" className={`${btn.base} ${btn.primary} ${btn.sm}`}>Télécharger en PNG</a>
                <a href="/admin/export/qr.svg" className={`${btn.base} ${btn.secondary} ${btn.sm}`}>SVG (imprimeur)</a>
                <a href="/admin/export/qr.png?path=/promotions" className={`${btn.base} ${btn.ghost} ${btn.sm}`}>QR vers les promotions</a>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
