"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./mobile-menu";

export function HeaderNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[0.9375rem] font-medium transition-colors ${active ? "bg-cream text-navy" : "text-ink hover:bg-cream/70 hover:text-navy"}`}
              >
                {item.label}
                {!!item.count && item.href === "/promotions" && (
                  <span className="tabular rounded-full bg-coral-text px-1.5 text-[0.6875rem] font-bold leading-4 text-white">{item.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
