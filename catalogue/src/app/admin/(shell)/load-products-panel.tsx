"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "@/components/admin/toast";
import { btn } from "@/components/ui";
import { loadEpicerieProductsAction } from "../actions/epicerie";

/** Premier démarrage : charge la liste de produits préparée (photos comprises). */
export function LoadProductsPanel({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="mb-6 rounded-[var(--radius-card)] border-2 border-navy bg-white p-5">
      <h2 className="font-sans text-lg font-semibold text-navy">Votre liste de produits est prête à être chargée</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {count} produit{count > 1 ? "s" : ""} de votre liste (pisco, aguardiente, Tajín, Harina P.A.N.…) ne sont pas encore dans le catalogue. Ils seront ajoutés avec leurs prix et leurs photos. Comptez une minute.
      </p>
      <button
        className={`${btn.base} ${btn.primary} ${btn.lg} mt-4`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await loadEpicerieProductsAction();
            if (!res.ok) return toast(res.error, "error");
            toast(res.message);
            router.refresh();
          })
        }
      >
        {pending ? "Chargement des produits et des photos…" : `Charger ${count > 1 ? `ces ${count} produits` : "ce produit"}`}
      </button>
    </div>
  );
}
