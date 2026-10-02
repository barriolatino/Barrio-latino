"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, MenuIcon } from "./icons";

export type NavItem = { href: string; label: string; count?: number };

export function MobileMenu({ items, contactHref }: { items: NavItem[]; contactHref: string | null }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-navy hover:bg-cream lg:hidden"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
      >
        <MenuIcon width={24} height={24} />
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) setOpen(false);
        }}
        className="m-0 ml-auto h-dvh max-h-none w-[min(22rem,88vw)] max-w-none bg-paper p-0 backdrop:bg-navy/40"
        aria-label="Menu"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-display text-xl font-bold text-navy">Menu</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-cream"
              aria-label="Fermer le menu"
            >
              <CloseIcon width={24} height={24} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Navigation principale">
            <ul>
              {items.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center justify-between rounded-lg px-3 py-3.5 text-lg font-medium ${active ? "bg-cream text-navy" : "text-ink hover:bg-cream"}`}
                    >
                      {item.label}
                      {!!item.count && <span className="tabular rounded-full bg-cream-deep px-2 text-sm text-ink-muted">{item.count}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {contactHref && (
            <div className="border-t border-line p-4">
              <a href={contactHref} className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#1f7a4d] font-semibold text-white">
                Commander sur WhatsApp
              </a>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
