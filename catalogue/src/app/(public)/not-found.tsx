import Link from "next/link";
import { btn } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="container-page py-20 text-center">
      <p className="font-display text-6xl font-extrabold text-sun">404</p>
      <h1 className="mt-2 text-3xl font-bold">Cette page n&apos;existe pas</h1>
      <p className="mt-2 text-ink-muted">Le produit a peut-être été retiré du catalogue.</p>
      <Link href="/catalogue" className={`${btn.base} ${btn.primary} ${btn.lg} mt-6`}>Voir le catalogue</Link>
    </div>
  );
}
