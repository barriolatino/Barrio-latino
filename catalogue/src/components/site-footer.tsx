import Link from "next/link";
import { getCategories, getCounts, getSettings } from "@/lib/catalogue";
import { socialLink, telLink, whatsappLink } from "@/lib/contact";
import { mediaSrc } from "@/lib/media-url";
import { ClockIcon, FacebookIcon, InstagramIcon, MailIcon, PhoneIcon, PinIcon, TikTokIcon, WhatsAppIcon } from "./icons";

export async function SiteFooter() {
  const [s, categories, counts] = await Promise.all([getSettings(), getCategories(), getCounts()]);
  const socials = [
    { href: socialLink("instagram", s.instagram), label: "Instagram", Icon: InstagramIcon },
    { href: socialLink("facebook", s.facebook), label: "Facebook", Icon: FacebookIcon },
    { href: socialLink("tiktok", s.tiktok), label: "TikTok", Icon: TikTokIcon },
  ].filter((x) => x.href);
  const wa = whatsappLink(s.whatsapp, s.whatsappMessage);
  const logo = s.logoKey ? mediaSrc(s.logoKey, 400) : "/logo.webp";
  const heading = "mb-3 font-display text-lg font-bold text-white";
  const link = "text-white/80 hover:text-white hover:underline underline-offset-4";

  return (
    <footer className="mt-16 bg-navy text-white/80 sm:mt-24">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" width={64} height={40} className="h-10 w-auto rounded" />
            <span className="font-display text-2xl font-extrabold text-white">{s.shopName}</span>
          </div>
          {s.description && <p className="mt-3 max-w-xs text-sm">{s.description}</p>}
          {socials.length > 0 && (
            <ul className="mt-4 flex gap-2">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a href={href!} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <nav aria-label="Pied de page">
          <h2 className={heading}>Navigation</h2>
          <ul className="space-y-2 text-sm">
            <li><Link className={link} href="/catalogue">Catalogue</Link></li>
            <li><Link className={link} href="/promotions">Promotions</Link></li>
            <li><Link className={link} href="/nouveautes">Nouveautés</Link></li>
            <li><Link className={link} href="/pays">Produits par pays</Link></li>
            <li><Link className={link} href="/contact">Contact</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className={heading}>Catégories</h2>
          <ul className="space-y-2 text-sm">
            {categories.filter((c) => c.count > 0).slice(0, 8).map((c) => (
              <li key={c.id}><Link className={link} href={`/categories/${c.slug}`}>{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className={heading}>Nous trouver</h2>
          <ul className="space-y-3 text-sm">
            {s.address && (
              <li className="flex gap-2"><PinIcon className="mt-0.5 shrink-0" /><span className="whitespace-pre-line">{s.address}</span></li>
            )}
            {s.openingHours && (
              <li className="flex gap-2"><ClockIcon className="mt-0.5 shrink-0" /><span className="whitespace-pre-line">{s.openingHours}</span></li>
            )}
            {s.phone && (
              <li className="flex gap-2"><PhoneIcon className="mt-0.5 shrink-0" /><a className={link} href={telLink(s.phone)!}>{s.phone}</a></li>
            )}
            {wa && (
              <li className="flex gap-2"><WhatsAppIcon className="mt-0.5 shrink-0" /><a className={link} href={wa}>WhatsApp</a></li>
            )}
            {s.email && (
              <li className="flex gap-2"><MailIcon className="mt-0.5 shrink-0" /><a className={link} href={`mailto:${s.email}`}>{s.email}</a></li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p>{s.footerText || `© ${new Date().getFullYear()} ${s.shopName}`}</p>
            {counts.alcohol > 0 && <p className="mt-1">L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération. Vente interdite aux mineurs.</p>}
          </div>
          <p className="flex gap-4">
            <Link className={link} href="/mentions-legales">Mentions légales</Link>
            <Link className={link} href="/confidentialite">Confidentialité</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
