"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "./icons";

/** Revient à la liste d'origine (filtres conservés) si l'on vient du site. */
export function BackLink({ fallback = "/catalogue" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <a
      href={fallback}
      onClick={(e) => {
        if (document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="mb-3 inline-flex h-10 items-center gap-1 rounded-full pr-3 text-sm font-semibold text-navy hover:underline underline-offset-4"
    >
      <ChevronLeft width={18} height={18} />
      Retour au catalogue
    </a>
  );
}
