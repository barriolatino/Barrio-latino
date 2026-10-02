"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { mediaSrc } from "@/lib/media-url";
import { searchMediaAction, uploadMediaAction, type MediaItem } from "@/app/admin/actions/media";
import { CloseIcon, ImageIcon } from "../icons";
import { btn } from "../ui";
import { prepareImage } from "./prepare-image";
import { toast } from "./toast";

/** Choix des photos d'un produit : la première est la photo principale. */
export function ImagePicker({ name, initial, multiple = true }: { name: string; initial: MediaItem[]; multiple?: boolean }) {
  const [items, setItems] = useState<MediaItem[]>(initial);
  const [uploading, startUpload] = useTransition();
  const [libOpen, setLibOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const add = (more: MediaItem[]) =>
    setItems((cur) => {
      const merged = [...cur, ...more.filter((m) => !cur.some((c) => c.id === m.id))];
      return multiple ? merged : merged.slice(-1);
    });

  return (
    <div>
      {items.map((m) => <input key={m.id} type="hidden" name={name} value={m.id} />)}
      <ul className="flex flex-wrap gap-3">
        {items.map((m, i) => (
          <li key={m.id} className="relative w-28">
            <div className={`flex aspect-square items-center justify-center overflow-hidden rounded-lg border-2 bg-white ${i === 0 ? "border-navy" : "border-line"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaSrc(m.key, 400)} alt={m.alt ?? ""} className="h-full w-full object-contain p-1" />
            </div>
            <p className="mt-1 text-center text-xs text-ink-muted">
              {i === 0 ? (
                <strong className="text-navy">{multiple ? "Principale" : "Image"}</strong>
              ) : (
                <button type="button" className="underline" onClick={() => setItems((cur) => [m, ...cur.filter((x) => x.id !== m.id)])}>
                  Mettre en principale
                </button>
              )}
            </p>
            <button
              type="button"
              onClick={() => setItems((cur) => cur.filter((x) => x.id !== m.id))}
              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-ink shadow-sm hover:bg-danger-bg hover:text-danger"
              aria-label={`Retirer l'image ${m.name}`}
            >
              <CloseIcon width={14} height={14} />
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="flex aspect-square w-28 flex-col items-center justify-center rounded-lg border-2 border-dashed border-line-strong text-xs text-ink-muted">
            <ImageIcon />
            Aucune photo
          </li>
        )}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            if (!files.length) return;
            startUpload(async () => {
              // Une photo par envoi : chaque requête reste légère.
              const added: MediaItem[] = [];
              for (const f of files) {
                const fd = new FormData();
                fd.append("files", await prepareImage(f));
                const res = await uploadMediaAction(fd);
                if (!res.ok) toast(res.error, "error");
                else added.push(...res.items);
              }
              if (added.length) {
                add(added);
                toast(added.length > 1 ? `${added.length} photos ajoutées` : "Photo ajoutée");
              }
              if (fileInput.current) fileInput.current.value = "";
            });
          }}
        />
        <button type="button" className={`${btn.base} ${btn.secondary} ${btn.sm}`} disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? "Envoi et optimisation…" : multiple ? "Ajouter des photos" : "Envoyer une image"}
        </button>
        <button type="button" className={`${btn.base} ${btn.ghost} ${btn.sm}`} onClick={() => setLibOpen(true)}>
          Choisir dans la médiathèque
        </button>
      </div>
      {libOpen && <MediaLibraryDialog onClose={() => setLibOpen(false)} onPick={(m) => { add([m]); setLibOpen(false); }} />}
    </div>
  );
}

function MediaLibraryDialog({ onClose, onPick }: { onClose: () => void; onPick: (m: MediaItem) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MediaItem[] | null>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await searchMediaAction(q);
      if (!cancelled) setItems(res);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(56rem,94vw)] rounded-[var(--radius-card)] bg-white p-0 backdrop:bg-navy/40" aria-label="Médiathèque">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une image…" className="h-11 flex-1 rounded-[var(--radius-control)] border border-line-strong px-3" />
        <button type="button" onClick={() => ref.current?.close()} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-cream" aria-label="Fermer">
          <CloseIcon />
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-4">
        {items === null ? (
          <p className="text-ink-muted">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-ink-muted">Aucune image.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {items.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onPick(m)} className="block w-full rounded-lg border border-line p-1 text-left hover:border-navy">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaSrc(m.key, 400)} alt="" loading="lazy" className="aspect-square w-full object-contain" />
                  <span className="mt-1 block truncate text-xs text-ink-muted">{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
