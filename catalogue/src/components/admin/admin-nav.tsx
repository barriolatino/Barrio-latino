"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CloseIcon, MenuIcon } from "../icons";

const NAV = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/products", label: "Produits" },
  { href: "/admin/products/new", label: "+ Ajouter un produit" },
  { href: "/admin/categories", label: "Catégories" },
  { href: "/admin/brands", label: "Marques" },
  { href: "/admin/countries", label: "Pays" },
  { href: "/admin/media", label: "Médiathèque" },
  { href: "/admin/import", label: "Importer" },
  { href: "/admin/export", label: "Exporter · PDF · QR code" },
  { href: "/admin/price-history", label: "Historique des prix" },
  { href: "/admin/revisions", label: "Corbeille et restauration" },
  { href: "/admin/settings", label: "Paramètres" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/products") return pathname === "/admin/products" || /^\/admin\/products\/(?!new)/.test(pathname);
  return pathname.startsWith(href);
}

export function AdminNav({ email, logout }: { email: string; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState(pathname);
  if (last !== pathname) {
    setLast(pathname);
    setOpen(false);
  }
  const links = (
    <nav aria-label="Administration">
      <ul className="space-y-0.5">
        {NAV.map((n) => (
          <li key={n.href}>
            <Link
              href={n.href}
              aria-current={isActive(pathname, n.href) ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-[0.9375rem] ${isActive(pathname, n.href) ? "bg-white/15 font-semibold text-white" : "text-white/75 hover:bg-white/10 hover:text-white"} ${n.href.endsWith("/new") ? "text-yellow" : ""}`}
            >
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
  const footer = (
    <div className="space-y-2 border-t border-white/10 pt-4 text-sm">
      <Link href="/" target="_blank" className="block px-3 text-white/75 hover:text-white">
        Voir le site ↗
      </Link>
      <p className="truncate px-3 text-white/50">{email}</p>
      <form action={logout}>
        <button className="px-3 text-white/75 underline underline-offset-4 hover:text-white">Se déconnecter</button>
      </form>
    </div>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between overflow-y-auto bg-navy p-4 lg:flex">
        <div>
          <Link href="/admin" className="mb-6 flex items-center gap-2 px-3 pt-2">
            <span className="font-display text-xl font-extrabold text-white">Barrio Latino</span>
            <span className="rounded bg-white/15 px-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-white/80">Admin</span>
          </Link>
          {links}
        </div>
        {footer}
      </aside>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-navy px-4 lg:hidden">
        <Link href="/admin" className="font-display text-lg font-extrabold text-white">
          Barrio Latino <span className="text-sm font-semibold text-white/70">Admin</span>
        </Link>
        <button onClick={() => setOpen(!open)} className="flex h-11 w-11 items-center justify-center text-white" aria-expanded={open} aria-label="Menu d'administration">
          {open ? <CloseIcon width={24} height={24} /> : <MenuIcon width={24} height={24} />}
        </button>
      </div>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-30 overflow-y-auto bg-navy p-4 lg:hidden">
          {links}
          <div className="mt-6">{footer}</div>
        </div>
      )}
    </>
  );
}
