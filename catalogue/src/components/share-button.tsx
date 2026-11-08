"use client";

import { useState } from "react";
import { CheckIcon, ShareIcon } from "./icons";

/** Partage natif sur mobile, copie du lien ailleurs. */
export function ShareButton({ title, text, path, className = "", label = "Partager ce produit" }: { title: string; text?: string; path: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const url = new URL(path, window.location.origin).toString();
        if (navigator.share) {
          try {
            await navigator.share({ title, text, url });
            return;
          } catch (e) {
            if ((e as Error).name === "AbortError") return;
          }
        }
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }}
    >
      {copied ? <CheckIcon /> : <ShareIcon />}
      <span aria-live="polite">{copied ? "Lien copié" : label}</span>
    </button>
  );
}
