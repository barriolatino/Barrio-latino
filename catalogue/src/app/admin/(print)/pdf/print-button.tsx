"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="h-10 rounded-full bg-navy px-5 text-sm font-semibold text-white">
      Imprimer / Enregistrer en PDF
    </button>
  );
}
