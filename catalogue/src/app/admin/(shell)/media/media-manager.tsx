"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { prepareImage } from "@/components/admin/prepare-image";
import { toast } from "@/components/admin/toast";
import { Panel, field } from "@/components/admin/ui";
import { btn } from "@/components/ui";
import { mediaSrc } from "@/lib/media-url";
import { deleteMediaAction, replaceMediaAction, updateMediaAction, uploadMediaAction } from "../../actions/media";

type Item = { id: string; key: string; name: string; alt: string | null; width: number; height: number; products: { id: string; name: string }[] };

export function MediaManager({ items }: { items: Item[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unused">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const upload = useRef<HTMLInputElement>(null);
  const replace = useRef<HTMLInputElement>(null);

  const shown = items.filter(
    (m) =>
      (filter === "all" || m.products.length === 0) &&
      (!q || `${m.name} ${m.alt ?? ""} ${m.products.map((p) => p.name).join(" ")}`.toLowerCase().includes(q.toLowerCase())),
  );
  const current = items.find((m) => m.id === open);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            ref={upload}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              start(async () => {
                let n = 0;
                for (const f of files) {
                  const fd = new FormData();
                  fd.append("files", await prepareImage(f));
                  const res = await uploadMediaAction(fd);
                  if (res.ok) n += res.items.length;
                  else toast(res.error, "error");
                }
                if (n) toast(`${n} image${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""}`);
                if (upload.current) upload.current.value = "";
                router.refresh();
              });
            }}
          />
          <button className={`${btn.base} ${btn.primary} ${btn.md}`} disabled={pending} onClick={() => upload.current?.click()}>
            {pending ? "Envoi…" : "+ Envoyer des images"}
          </button>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, produit)…" aria-label="Rechercher une image" className={`${field.input} mt-0 max-w-xs`} />
          <select value={filter} onChange={(e) => setFilter(e.target.value as "all" | "unused")} aria-label="Filtre" className={`${field.input} mt-0 w-auto`}>
            <option value="all">Toutes ({items.length})</option>
            <option value="unused">Non utilisées ({items.filter((m) => !m.products.length).length})</option>
          </select>
        </div>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setOpen(m.id)} className={`block w-full rounded-lg border-2 bg-white p-1 text-left ${open === m.id ? "border-navy" : "border-line hover:border-line-strong"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaSrc(m.key, 400)} alt="" loading="lazy" className="aspect-square w-full object-contain" />
                <span className="mt-1 block truncate text-xs">{m.name}</span>
                <span className={`block text-[0.6875rem] ${m.products.length ? "text-ink-muted" : "text-coral-text"}`}>
                  {m.products.length ? `${m.products.length} produit${m.products.length > 1 ? "s" : ""}` : "Non utilisée"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      {current && (
        <Panel title="Image sélectionnée" className="self-start xl:sticky xl:top-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaSrc(current.key, 800)} alt="" className="aspect-square w-full rounded-lg border border-line bg-white object-contain" />
          <p className="tabular mt-1 text-xs text-ink-muted">{current.width} × {current.height} px · WebP</p>
          <form
            key={current.id}
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                await updateMediaAction(current.id, { name: String(fd.get("name")), alt: String(fd.get("alt")) });
                toast("Image enregistrée");
                router.refresh();
              });
            }}
          >
            <label className={field.label}>Nom<input name="name" defaultValue={current.name} className={field.input} /></label>
            <label className={field.label}>
              Texte alternatif
              <input name="alt" defaultValue={current.alt ?? ""} className={field.input} placeholder="Ex. Paquet de 5 arepas blanches La Victoria" />
              <span className={field.help}>Lu par les malvoyants et Google. Par défaut : le nom du produit.</span>
            </label>
            <button className={`${btn.base} ${btn.primary} ${btn.sm}`}>Enregistrer</button>
          </form>
          {current.products.length > 0 && (
            <div className="mt-4 text-sm">
              <p className="font-medium">Utilisée par :</p>
              <ul className="mt-1 list-disc pl-5">
                {current.products.map((p) => <li key={p.id}><Link className="underline" href={`/admin/products/${p.id}`}>{p.name}</Link></li>)}
              </ul>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            <input
              ref={replace}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                start(async () => {
                  const fd = new FormData();
                  fd.append("file", await prepareImage(f));
                  const res = await replaceMediaAction(current.id, fd);
                  if (!res.ok) toast(res.error ?? "Erreur", "error");
                  else toast("Image remplacée partout");
                  if (replace.current) replace.current.value = "";
                  router.refresh();
                });
              }}
            />
            <button className={`${btn.base} ${btn.secondary} ${btn.sm}`} disabled={pending} onClick={() => replace.current?.click()}>Remplacer le fichier</button>
            <button
              className={`${btn.base} ${btn.sm} text-danger hover:bg-danger-bg`}
              onClick={() =>
                confirm("Supprimer définitivement cette image ?") &&
                start(async () => {
                  const res = await deleteMediaAction(current.id);
                  if (!res.ok) return toast(res.error ?? "Erreur", "error");
                  toast("Image supprimée");
                  setOpen(null);
                  router.refresh();
                })
              }
            >
              Supprimer
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}
