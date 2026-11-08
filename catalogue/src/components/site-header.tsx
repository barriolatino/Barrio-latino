import Link from "next/link";
import { Suspense } from "react";
import { getCounts, getSettings } from "@/lib/catalogue";
import { whatsappLink } from "@/lib/contact";
import { mediaSrc } from "@/lib/media-url";
import { MobileMenu, type NavItem } from "./mobile-menu";
import { SearchBox } from "./search-box";
import { HeaderNav } from "./header-nav";

export async function SiteHeader() {
  const [settings, counts] = await Promise.all([getSettings(), getCounts()]);
  const items: NavItem[] = [
    { href: "/", label: "Accueil" },
    { href: "/catalogue", label: "Catalogue" },
    { href: "/categories", label: "Catégories" },
    { href: "/promotions", label: "Promotions", count: counts.promotions },
    { href: "/nouveautes", label: "Nouveautés", count: counts.nouveautes },
    { href: "/pays", label: "Pays" },
    { href: "/contact", label: "Contact" },
  ];
  const wa = whatsappLink(settings.whatsapp, settings.whatsappMessage);
  const logo = settings.logoKey ? mediaSrc(settings.logoKey, 400) : "/logo.webp";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-navy focus:px-4 focus:py-2 focus:text-white">
        Aller au contenu
      </a>
      <div className="container-page flex h-16 items-center gap-3 lg:h-[4.5rem] lg:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${settings.shopName}, accueil`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={56} height={36} className="h-9 w-auto" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[1.375rem] font-extrabold text-navy">{settings.shopName}</span>
            {settings.shopKicker && <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-coral-text">{settings.shopKicker}</span>}
          </span>
        </Link>
        <HeaderNav items={items.slice(1)} />
        <div className="ml-auto hidden w-full max-w-xs md:block xl:max-w-sm">
          <Suspense>
            <SearchBox id="search-desktop" />
          </Suspense>
        </div>
        <div className="ml-auto md:ml-0">
          <MobileMenu items={items} contactHref={wa} />
        </div>
      </div>
      <div className="container-page pb-3 md:hidden">
        <Suspense>
          <SearchBox id="search-mobile" />
        </Suspense>
      </div>
    </header>
  );
}
