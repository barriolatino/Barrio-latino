import Link from "next/link";
import { ChevronRight } from "./icons";

// Boutons et éléments partagés du design system.
export const btn = {
  base: "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none",
  primary: "bg-navy text-white hover:bg-navy-soft",
  secondary: "border border-line-strong bg-paper text-navy hover:border-navy",
  ghost: "text-navy hover:bg-cream",
  whatsapp: "bg-[#1f7a4d] text-white hover:bg-[#186640]",
  danger: "bg-danger text-white hover:bg-[#931c13]",
  md: "h-11 px-5 text-[0.9375rem]",
  sm: "h-9 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function SectionHeader({
  title,
  href,
  linkLabel = "Tout voir",
  kicker,
  id,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  kicker?: string;
  id?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-6">
      <div>
        {kicker && <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-coral-text">{kicker}</p>}
        <h2 id={id} className="text-2xl font-bold sm:text-[2rem]">
          {title}
        </h2>
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-navy underline-offset-4 hover:underline">
          {linkLabel}
          <ChevronRight width={16} height={16} />
        </Link>
      )}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight width={14} height={14} className="text-ink-faint" />}
            {item.href ? (
              <Link href={item.href} className="hover:text-navy hover:underline underline-offset-4">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageTitle({ title, intro, children }: { title: string; intro?: string | null; children?: React.ReactNode }) {
  return (
    <header className="mb-6 sm:mb-8">
      <h1 className="text-[2rem] font-extrabold sm:text-5xl">{title}</h1>
      {intro && <p className="mt-2 max-w-2xl text-ink-muted sm:text-lg">{intro}</p>}
      {children}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong bg-cream/50 px-6 py-12 text-center">
      <p className="font-display text-xl font-bold text-navy">{title}</p>
      {children && <div className="mt-2 text-ink-muted">{children}</div>}
    </div>
  );
}
