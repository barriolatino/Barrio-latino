"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImagePicker } from "@/components/admin/image-picker";
import { toast } from "@/components/admin/toast";
import { Panel, field } from "@/components/admin/ui";
import { ChevronDown, ChevronUp, GripIcon } from "@/components/icons";
import { btn } from "@/components/ui";
import type { MediaItem } from "../../actions/media";
import { deleteCategoryAction, reorderCategoriesAction, saveCategoryAction } from "../../actions/taxonomy";

export type CatRow = { id: string; name: string; slug: string; description: string; parentId: string | null; count: number; image: MediaItem | null };

function SortableList({ items, render, onReorder }: { items: CatRow[]; render: (c: CatRow) => React.ReactNode; onReorder: (ids: string[]) => void }) {
  const [order, setOrder] = useState(items);
  const [drag, setDrag] = useState<string | null>(null);
  const [lastItems, setLastItems] = useState(items);
  if (items !== lastItems) {
    setLastItems(items);
    setOrder(items);
  }
  const commit = (next: CatRow[]) => {
    setOrder(next);
    onReorder(next.map((x) => x.id));
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };
  return (
    <ul className="divide-y divide-line">
      {order.map((c, i) => (
        <li
          key={c.id}
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            setDrag(c.id);
          }}
          onDragOver={(e) => {
            if (!drag || drag === c.id || !order.some((x) => x.id === drag)) return;
            e.stopPropagation();
            e.preventDefault();
            setOrder((o) => {
              const from = o.findIndex((x) => x.id === drag);
              const to = o.findIndex((x) => x.id === c.id);
              const next = [...o];
              next.splice(to, 0, next.splice(from, 1)[0]);
              return next;
            });
          }}
          onDragEnd={(e) => {
            e.stopPropagation();
            if (!drag) return;
            setDrag(null);
            onReorder(order.map((x) => x.id));
          }}
          className={`flex items-start gap-2 py-2 ${drag === c.id ? "opacity-50" : ""}`}
        >
          <span className="flex flex-col items-center pt-1 text-ink-muted">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter ${c.name}`} className="disabled:opacity-30"><ChevronUp width={16} height={16} /></button>
            <GripIcon width={16} height={16} className="cursor-grab" />
            <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Descendre ${c.name}`} className="disabled:opacity-30"><ChevronDown width={16} height={16} /></button>
          </span>
          <div className="min-w-0 flex-1">{render(c)}</div>
        </li>
      ))}
    </ul>
  );
}

function CategoryEditor({ cat, roots, onDone }: { cat: Partial<CatRow> & { parentId?: string | null }; roots: CatRow[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 rounded-lg border border-line bg-[#faf8f4] p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await saveCategoryAction(cat.id ?? null, {
            name: String(fd.get("name")),
            description: String(fd.get("description") ?? ""),
            parentId: String(fd.get("parentId") ?? ""),
            imageId: String(fd.get("imageId") ?? ""),
          });
          if (!res.ok) return toast(res.error, "error");
          toast(res.message ?? "Enregistré");
          onDone();
          router.refresh();
        });
      }}
    >
      <label className={field.label}>
        Nom *
        <input name="name" defaultValue={cat.name} required autoFocus className={field.input} />
      </label>
      <label className={field.label}>
        Rangée dans
        <select name="parentId" defaultValue={cat.parentId ?? ""} className={field.input}>
          <option value="">— Catégorie principale —</option>
          {roots.filter((r) => r.id !== cat.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      <label className={`${field.label} sm:col-span-2`}>
        Description courte
        <input name="description" defaultValue={cat.description} maxLength={300} className={field.input} />
      </label>
      <div className="sm:col-span-2">
        <p className={field.label}>Image (facultative)</p>
        <ImagePicker name="imageId" initial={cat.image ? [cat.image] : []} multiple={false} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <button className={`${btn.base} ${btn.primary} ${btn.md}`} disabled={pending}>{pending ? "…" : "Enregistrer"}</button>
        <button type="button" className={`${btn.base} ${btn.ghost} ${btn.md}`} onClick={onDone}>Annuler</button>
      </div>
    </form>
  );
}

export function CategoriesManager({ rows }: { rows: CatRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null); // id, "new", ou "new:<parentId>"
  const [, start] = useTransition();
  const roots = rows.filter((r) => !r.parentId);
  const childrenOf = (id: string) => rows.filter((r) => r.parentId === id);
  const total = (c: CatRow) => c.count + childrenOf(c.id).reduce((n, x) => n + x.count, 0);

  const reorder = (ids: string[]) =>
    start(async () => {
      const res = await reorderCategoriesAction(ids);
      if (res.ok) toast(res.message ?? "Ordre enregistré");
      router.refresh();
    });
  const remove = (c: CatRow) => {
    if (!confirm(`Supprimer la catégorie « ${c.name} » ?`)) return;
    start(async () => {
      const res = await deleteCategoryAction(c.id);
      if (!res.ok) return toast(res.error, "error");
      toast(res.message ?? "Supprimée");
      router.refresh();
    });
  };

  const line = (c: CatRow) =>
    editing === c.id ? (
      <CategoryEditor cat={c} roots={roots} onDone={() => setEditing(null)} />
    ) : (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">
            {c.name}{" "}
            <span className="tabular text-sm font-normal text-ink-muted">
              · {total(c)} produit{total(c) > 1 ? "s" : ""}
            </span>
          </p>
          {c.description && <p className="text-sm text-ink-muted">{c.description}</p>}
        </div>
        <div className="flex gap-1">
          {!c.parentId && <button type="button" className={`${btn.base} ${btn.ghost} ${btn.sm}`} onClick={() => setEditing(`new:${c.id}`)}>+ Sous-catégorie</button>}
          <button type="button" className={`${btn.base} ${btn.secondary} ${btn.sm}`} onClick={() => setEditing(c.id)}>Modifier</button>
          <button type="button" className={`${btn.base} ${btn.sm} text-danger hover:bg-danger-bg`} onClick={() => remove(c)}>Supprimer</button>
        </div>
      </div>
    );

  return (
    <Panel>
      <div className="mb-4">
        {editing === "new" ? (
          <CategoryEditor cat={{}} roots={roots} onDone={() => setEditing(null)} />
        ) : (
          <button className={`${btn.base} ${btn.primary} ${btn.md}`} onClick={() => setEditing("new")}>+ Nouvelle catégorie</button>
        )}
      </div>
      <SortableList
        items={roots}
        onReorder={reorder}
        render={(c) => (
          <>
            {line(c)}
            {(childrenOf(c.id).length > 0 || editing === `new:${c.id}`) && (
              <div className="mt-2 border-l-2 border-line pl-4">
                {editing === `new:${c.id}` && <CategoryEditor cat={{ parentId: c.id }} roots={roots} onDone={() => setEditing(null)} />}
                <SortableList items={childrenOf(c.id)} onReorder={reorder} render={line} />
              </div>
            )}
          </>
        )}
      />
    </Panel>
  );
}
