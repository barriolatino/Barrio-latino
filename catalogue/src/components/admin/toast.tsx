"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; text: string; tone: "success" | "error" };
let listeners: ((t: Toast) => void)[] = [];
let counter = 0;

/** Message bref en bas de l'écran : « Enregistré », « Prix invalide »… */
export function toast(text: string, tone: Toast["tone"] = "success") {
  const t = { id: ++counter, text, tone };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const l = (t: Toast) => {
      setItems((x) => [...x, t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), t.tone === "error" ? 6000 : 2500);
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
      {items.map((t) => (
        <p key={t.id} className={`pointer-events-auto rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg ${t.tone === "error" ? "bg-danger text-white" : "bg-navy text-white"}`}>
          {t.tone === "success" ? "✓ " : ""}
          {t.text}
        </p>
      ))}
    </div>
  );
}
