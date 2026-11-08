import { STORAGE_LABELS } from "@/lib/format";
import { SnowIcon } from "./icons";

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide leading-5";

export function StorageBadge({ storage }: { storage: "AMBIENT" | "CHILLED" | "FROZEN" }) {
  if (storage === "AMBIENT") return null;
  if (storage === "FROZEN")
    return (
      <span className={`${pill} bg-turquoise-deep text-white`}>
        <SnowIcon width={12} height={12} strokeWidth={2.5} />
        {STORAGE_LABELS.FROZEN}
      </span>
    );
  return <span className={`${pill} bg-green text-white`}>{STORAGE_LABELS.CHILLED}</span>;
}

export function NewBadge() {
  return <span className={`${pill} bg-yellow text-navy`}>Nouveau</span>;
}

export function PromoBadge({ percent }: { percent: number }) {
  return <span className={`${pill} bg-coral-text text-white tabular`}>−{percent} %</span>;
}

export function UnavailableBadge() {
  return <span className={`${pill} bg-ink-muted text-white`}>Indisponible</span>;
}

export function ExampleBadge() {
  return <span className={`${pill} border border-dashed border-ink-faint bg-paper text-ink-muted`}>Exemple</span>;
}
