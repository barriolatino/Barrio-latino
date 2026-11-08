"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { ImagePicker } from "@/components/admin/image-picker";
import { Panel, field } from "@/components/admin/ui";
import { btn } from "@/components/ui";
import { formatPrice, parsePrice } from "@/lib/format";
import type { ProductFormValues } from "./form-values";
import { saveProductAction } from "../../actions/products";

type Option = { id: string; label: string };

function Field({ label, name, error, help, required, children }: { label: string; name: string; error?: string; help?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className={field.label}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? <p id={`${name}-error`} className={field.error}>{error}</p> : help ? <p className={field.help}>{help}</p> : null}
    </div>
  );
}

function Check({ name, label, help, defaultChecked }: { name: string; label: string; help?: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 hover:bg-cream/40">
      <input type="checkbox" name={name} value="1" defaultChecked={defaultChecked} className="mt-0.5 h-5 w-5 accent-navy" />
      <span>
        <span className="block font-medium">{label}</span>
        {help && <span className="block text-xs text-ink-muted">{help}</span>}
      </span>
    </label>
  );
}

export function ProductForm({
  values: v,
  categories,
  countries,
  brands,
}: {
  values: ProductFormValues;
  categories: Option[];
  countries: Option[];
  brands: string[];
}) {
  const [state, action, pending] = useActionState(saveProductAction, null);
  const errors = (state && !state.ok && state.fields) || {};
  const [price, setPrice] = useState(v.price);
  const [promo, setPromo] = useState(v.promo);
  const [cost, setCost] = useState(v.cost);
  const costCents = parsePrice(cost);
  const priceCents = parsePrice(price);
  const promoCents = parsePrice(promo);
  const saving = priceCents !== null && promoCents !== null && promoCents < priceCents ? priceCents - promoCents : null;
  const inputProps = (name: string) => ({ id: name, name, "aria-invalid": !!errors[name], "aria-describedby": errors[name] ? `${name}-error` : undefined });

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        // Envoi manuel : en cas d'erreur, les champs gardent ce qui a été saisi.
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => action(fd));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      {v.id && <input type="hidden" name="id" value={v.id} />}
      {state && !state.ok && (
        <p role="alert" className="rounded-[var(--radius-card)] border border-danger bg-danger-bg p-4 text-danger">
          <strong>{state.error}</strong>
          {Object.values(errors).length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-sm">
              {Object.values(errors).map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title="Produit">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Nom" name="name" required error={errors.name}>
                  <input {...inputProps("name")} defaultValue={v.name} required className={field.input} placeholder="Ex. Arepas blanches" />
                </Field>
              </div>
              <Field label="Marque" name="brandName" help="Choisissez dans la liste ou tapez une nouvelle marque.">
                <input id="brandName" name="brandName" list="brands-list" defaultValue={v.brandName} className={field.input} autoComplete="off" />
                <datalist id="brands-list">{brands.map((b) => <option key={b} value={b} />)}</datalist>
              </Field>
              <Field label="Référence" name="reference" error={errors.reference} help="Facultative. Doit être unique.">
                <input {...inputProps("reference")} defaultValue={v.reference} className={field.input} />
              </Field>
              <Field label="Catégorie" name="categoryId" required error={errors.categoryId}>
                <select {...inputProps("categoryId")} defaultValue={v.categoryId} className={field.input} required>
                  <option value="">Choisir…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Pays d'origine" name="countryId" help="Facultatif.">
                <select id="countryId" name="countryId" defaultValue={v.countryId} className={field.input}>
                  <option value="">—</option>
                  {countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description" name="description" help="Conseils de préparation, goût, usage…">
                  <textarea id="description" name="description" defaultValue={v.description} rows={4} className={field.textarea} />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel title="Format et conditionnement">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Poids net (g)" name="netWeightG" error={errors.netWeightG} help="Ex. 500 ; 1 kg = 1000">
                <input {...inputProps("netWeightG")} defaultValue={v.netWeightG} inputMode="numeric" className={field.input} />
              </Field>
              <Field label="Volume (ml)" name="volumeMl" error={errors.volumeMl} help="Ex. 330 ; 1 L = 1000">
                <input {...inputProps("volumeMl")} defaultValue={v.volumeMl} inputMode="numeric" className={field.input} />
              </Field>
              <Field label="Nombre de pièces" name="unitCount" error={errors.unitCount} help="Ex. 5 arepas">
                <input {...inputProps("unitCount")} defaultValue={v.unitCount} inputMode="numeric" className={field.input} />
              </Field>
              <Field label="Conditionnement" name="packaging" help="Ex. Paquet de 5, Sachet, Pot">
                <input id="packaging" name="packaging" defaultValue={v.packaging} className={field.input} />
              </Field>
              <Field label="Conservation" name="storage">
                <select id="storage" name="storage" defaultValue={v.storage} className={field.input}>
                  <option value="AMBIENT">Épicerie (température ambiante)</option>
                  <option value="CHILLED">Frais (réfrigéré)</option>
                  <option value="FROZEN">Surgelé</option>
                </select>
              </Field>
              <Field label="Vendu" name="saleUnit">
                <select id="saleUnit" name="saleUnit" defaultValue={v.saleUnit} className={field.input}>
                  <option value="UNIT">À l&apos;unité</option>
                  <option value="KG">Au kilo (prix au kg)</option>
                </select>
              </Field>
            </div>
          </Panel>

          <Panel title="Photos">
            <ImagePicker name="imageIds" initial={v.images} />
            <p className={field.help}>Format carré conseillé, fond uni. Les photos sont recadrées et compressées automatiquement, sans être déformées.</p>
          </Panel>

          <details className="rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-6">
            <summary className="cursor-pointer font-semibold text-navy">Mots-clés et référencement (facultatif)</summary>
            <div className="mt-4 grid gap-4">
              <Field label="Mots-clés" name="tags" help="Séparés par des virgules. Aident la recherche : « fruit de la passion, jus ».">
                <input id="tags" name="tags" defaultValue={v.tags} className={field.input} />
              </Field>
              <Field label="Titre pour Google" name="seoTitle" help="Laissez vide pour utiliser le nom du produit.">
                <input id="seoTitle" name="seoTitle" defaultValue={v.seoTitle} className={field.input} maxLength={70} />
              </Field>
              <Field label="Description pour Google" name="seoDescription" help="160 caractères maximum.">
                <textarea id="seoDescription" name="seoDescription" defaultValue={v.seoDescription} rows={2} maxLength={160} className={field.textarea} />
              </Field>
            </div>
          </details>
        </div>

        <div className="space-y-6">
          <Panel title="Prix">
            <div className="space-y-4">
              <Field label="Prix de vente (€)" name="priceCents" required error={errors.priceCents} help="Ex. 3,49">
                <input {...inputProps("priceCents")} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={`${field.input} tabular text-lg font-semibold`} required />
              </Field>
              <Field label="Prix promotionnel (€)" name="promoCents" error={errors.promoCents} help="Vide = pas de promotion.">
                <input {...inputProps("promoCents")} value={promo} onChange={(e) => setPromo(e.target.value)} inputMode="decimal" className={`${field.input} tabular`} />
              </Field>
              {saving !== null && (
                <p className="tabular rounded-md bg-[#fdecea] px-3 py-2 text-sm font-semibold text-coral-text">
                  Économie affichée : {formatPrice(saving)} (−{Math.round((saving / priceCents!) * 100)} %)
                </p>
              )}
              <Field label="Fin de la promotion" name="promoEndsAt" help="Facultatif : la promotion s'arrête seule à cette date.">
                <input id="promoEndsAt" name="promoEndsAt" type="date" defaultValue={v.promoEndsAt} className={field.input} />
              </Field>
              <div className="border-t border-line pt-4">
                <Field label="Prix d'achat (€)" name="costCents" error={errors.costCents} help="Privé : jamais affiché sur le site. Sert à suivre votre marge.">
                  <input {...inputProps("costCents")} value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" className={`${field.input} tabular`} />
                </Field>
                {costCents !== null && priceCents !== null && priceCents > 0 && (
                  <p className="tabular mt-2 text-sm text-ink-muted">
                    Marge : <strong className={priceCents - costCents < 0 ? "text-danger" : "text-ink"}>{formatPrice(priceCents - costCents)}</strong> par article
                    {" "}({Math.round(((priceCents - costCents) / priceCents) * 100)} % du prix de vente
                    {promoCents !== null && promoCents < priceCents && <>, {formatPrice(promoCents - costCents)} en promotion</>})
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
                <Field label="Carton de" name="caseQuantity" error={errors.caseQuantity} help="Nb d'articles">
                  <input {...inputProps("caseQuantity")} defaultValue={v.caseQuantity} inputMode="numeric" className={field.input} />
                </Field>
                <Field label="Prix du carton (€)" name="casePriceCents" error={errors.casePriceCents}>
                  <input {...inputProps("casePriceCents")} defaultValue={v.casePrice} inputMode="decimal" className={`${field.input} tabular`} />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel title="Statut">
            <div className="space-y-2">
              <Check name="published" label="Publié" help="Visible sur le catalogue public." defaultChecked={v.published} />
              <Check name="available" label="Disponible" help="Décochez en cas de rupture : le produit reste visible avec la mention « Indisponible »." defaultChecked={v.available} />
              <Check name="isNew" label="Nouveauté" defaultChecked={v.isNew} />
              <Check name="featured" label="Mis en avant" help="Apparaît dans « Nos incontournables »." defaultChecked={v.featured} />
            </div>
          </Panel>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-[#f7f5f1]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <button type="submit" disabled={pending} className={`${btn.base} ${btn.primary} ${btn.lg}`}>
          {pending ? "Enregistrement…" : v.id ? "Enregistrer les modifications" : "Publier le produit"}
        </button>
        {!v.id && (
          <button type="submit" name="$then" value="new" disabled={pending} className={`${btn.base} ${btn.secondary} ${btn.lg}`}>
            Publier et ajouter un autre
          </button>
        )}
        <Link href="/admin/products" className="px-2 text-sm font-medium text-ink-muted underline underline-offset-4">Annuler</Link>
      </div>
    </form>
  );
}
