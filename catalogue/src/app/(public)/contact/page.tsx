import type { Metadata } from "next";
import { ClockIcon, MailIcon, PhoneIcon, PinIcon, WhatsAppIcon } from "@/components/icons";
import { PageTitle, btn } from "@/components/ui";
import { getSettings } from "@/lib/catalogue";
import { telLink, whatsappLink } from "@/lib/contact";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  const s = await getSettings();
  const wa = whatsappLink(s.whatsapp, s.whatsappMessage);
  const row = "flex gap-4 border-b border-line py-4";
  return (
    <div className="container-page py-6 sm:py-10">
      <PageTitle title="Contact" intro="Une question, une commande ? Passez nous voir ou écrivez-nous." />
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <ul>
            {s.address && (
              <li className={row}>
                <PinIcon className="mt-1 shrink-0 text-coral-text" />
                <div>
                  <h2 className="font-sans text-sm font-semibold text-ink-muted">Adresse</h2>
                  <p className="whitespace-pre-line text-lg">{s.address}</p>
                  {s.mapUrl && <a href={s.mapUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-navy underline underline-offset-4">Voir sur la carte</a>}
                </div>
              </li>
            )}
            {s.openingHours && (
              <li className={row}>
                <ClockIcon className="mt-1 shrink-0 text-coral-text" />
                <div>
                  <h2 className="font-sans text-sm font-semibold text-ink-muted">Horaires</h2>
                  <p className="whitespace-pre-line text-lg">{s.openingHours}</p>
                </div>
              </li>
            )}
            {s.phone && (
              <li className={row}>
                <PhoneIcon className="mt-1 shrink-0 text-coral-text" />
                <div>
                  <h2 className="font-sans text-sm font-semibold text-ink-muted">Téléphone</h2>
                  <a href={telLink(s.phone)!} className="text-lg hover:underline underline-offset-4">{s.phone}</a>
                </div>
              </li>
            )}
            {s.email && (
              <li className={row}>
                <MailIcon className="mt-1 shrink-0 text-coral-text" />
                <div>
                  <h2 className="font-sans text-sm font-semibold text-ink-muted">E-mail</h2>
                  <a href={`mailto:${s.email}`} className="text-lg hover:underline underline-offset-4">{s.email}</a>
                </div>
              </li>
            )}
          </ul>
          {!s.address && !s.phone && !s.email && <p className="text-ink-muted">Les coordonnées seront bientôt renseignées.</p>}
        </div>
        {wa && (
          <div className="self-start rounded-[var(--radius-card)] bg-cream p-6 sm:p-8">
            <h2 className="text-2xl font-bold">Commander par WhatsApp</h2>
            <p className="mt-2 text-ink-muted">Envoyez-nous la liste des produits (avec leur référence si possible) : nous préparons votre commande pour le retrait en magasin.</p>
            <a href={wa} className={`${btn.base} ${btn.whatsapp} ${btn.lg} mt-5`}>
              <WhatsAppIcon /> Écrire sur WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
