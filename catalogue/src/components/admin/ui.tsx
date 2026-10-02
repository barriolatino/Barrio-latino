import Link from "next/link";

export const field = {
  label: "block text-sm font-medium text-ink",
  input:
    "mt-1 h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15 aria-[invalid=true]:border-danger",
  textarea:
    "mt-1 w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3 py-2 text-[0.9375rem] text-ink focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15",
  help: "mt-1 text-xs text-ink-muted",
  error: "mt-1 text-sm font-medium text-danger",
};

export function AdminHeader({ title, intro, actions }: { title: string; intro?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.75rem] font-bold sm:text-3xl">{title}</h1>
        {intro && <div className="mt-1 max-w-2xl text-sm text-ink-muted">{intro}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-6 ${className}`}>
      {title && <h2 className="mb-4 font-sans text-base font-semibold text-navy">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: "danger" | "promo" }) {
  const body = (
    <>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={`tabular mt-1 font-display text-3xl font-extrabold ${tone === "danger" ? "text-danger" : tone === "promo" ? "text-coral-text" : "text-navy"}`}>{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-[var(--radius-card)] border border-line bg-white p-4 hover:border-navy">
      {body}
    </Link>
  ) : (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-4">{body}</div>
  );
}
