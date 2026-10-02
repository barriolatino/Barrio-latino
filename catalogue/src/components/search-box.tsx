"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "./icons";

/** Recherche instantanée : met à jour le catalogue pendant la frappe. */
export function SearchBox({ id, autoFocus = false }: { id: string; autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const onCatalogue = pathname === "/catalogue";
  const urlQuery = onCatalogue ? (params.get("q") ?? "") : "";
  const [value, setValue] = useState(urlQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);

  // Le champ suit l'URL (retour arrière, lien partagé…).
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function go(q: string, replace: boolean) {
    const next = new URLSearchParams(onCatalogue ? params.toString() : "");
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    next.delete("page");
    const url = `/catalogue${next.size ? `?${next}` : ""}`;
    if (replace && onCatalogue) router.replace(url, { scroll: false });
    else router.push(url);
  }

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(value, onCatalogue);
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Rechercher un produit
      </label>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input
        id={id}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="Arepa, maracuyá, Goya, réf…"
        value={value}
        onChange={(e) => {
          const q = e.target.value;
          setValue(q);
          if (!onCatalogue) return; // ailleurs, on attend la validation
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => go(q, true), 250);
        }}
        className="h-11 w-full rounded-full border border-line-strong bg-paper pl-10 pr-10 text-[1rem] text-ink placeholder:text-ink-faint focus:border-navy focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-navy/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            if (onCatalogue) go("", true);
          }}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-cream"
          aria-label="Effacer la recherche"
        >
          <CloseIcon width={16} height={16} />
        </button>
      )}
    </form>
  );
}
