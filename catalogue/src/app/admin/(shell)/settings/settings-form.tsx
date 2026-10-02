"use client";

import { startTransition, useActionState, useEffect } from "react";
import { ImagePicker } from "@/components/admin/image-picker";
import { toast } from "@/components/admin/toast";
import { Panel, field } from "@/components/admin/ui";
import { btn } from "@/components/ui";
import type { MediaItem } from "../../actions/media";
import { changePasswordAction, saveSettingsAction } from "../../actions/settings";

type Values = Record<string, string | number | boolean | null | undefined>;

function T({ name, label, v, help, area, type = "text" }: { name: string; label: string; v: Values; help?: string; area?: number; type?: string }) {
  return (
    <label className={field.label}>
      {label}
      {area ? (
        <textarea name={name} defaultValue={(v[name] as string) ?? ""} rows={area} className={field.textarea} />
      ) : (
        <input name={name} type={type} defaultValue={(v[name] as string) ?? ""} className={field.input} />
      )}
      {help && <span className={field.help}>{help}</span>}
    </label>
  );
}

export function SettingsForm({ values: v, logo }: { values: Values; logo: MediaItem | null }) {
  const [state, action, pending] = useActionState(saveSettingsAction, null);
  const [pwState, pwAction, pwPending] = useActionState(changePasswordAction, null);
  useEffect(() => {
    if (state?.ok) toast("Paramètres enregistrés");
    if (state && !state.ok) toast(state.error, "error");
  }, [state]);
  useEffect(() => {
    if (pwState?.ok) toast("Mot de passe modifié");
    if (pwState && !pwState.ok) toast(pwState.error, "error");
  }, [pwState]);

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
        className="space-y-6"
      >
        {state && !state.ok && <p role="alert" className="rounded-md bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="L'épicerie">
            <div className="grid gap-4">
              <T name="shopName" label="Nom de l'épicerie *" v={v} />
              <T name="shopKicker" label="Sous-titre" v={v} help="Affiché sous le nom : « Épicerie latino-américaine »." />
              <T name="description" label="Description" v={v} area={2} help="Utilisée par Google et en pied de page." />
              <div>
                <p className={field.label}>Logo</p>
                <ImagePicker name="logoMediaId" initial={logo ? [logo] : []} multiple={false} />
                <p className={field.help}>Sans logo choisi, celui du restaurant est utilisé.</p>
              </div>
            </div>
          </Panel>
          <Panel title="Accueil">
            <div className="grid gap-4">
              <T name="heroTitle" label="Titre d'accueil *" v={v} />
              <T name="heroText" label="Texte d'accueil" v={v} area={3} />
              <T name="footerText" label="Message de bas de page" v={v} help="Vide : « © année + nom »." />
            </div>
          </Panel>
          <Panel title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <T name="phone" label="Téléphone" v={v} type="tel" />
              <T name="whatsapp" label="WhatsApp (commandes)" v={v} type="tel" help="Ex. +33 6 12 34 56 78. Vide = pas de bouton WhatsApp." />
              <div className="sm:col-span-2"><T name="whatsappMessage" label="Début du message WhatsApp" v={v} /></div>
              <T name="email" label="E-mail" v={v} type="email" />
              <T name="mapUrl" label="Lien Google Maps" v={v} />
              <T name="address" label="Adresse" v={v} area={2} />
              <T name="openingHours" label="Horaires" v={v} area={3} help="Une ligne par jour ou par période." />
            </div>
          </Panel>
          <Panel title="Réseaux sociaux">
            <div className="grid gap-4">
              <T name="instagram" label="Instagram" v={v} help="Nom du compte ou lien complet." />
              <T name="facebook" label="Facebook" v={v} />
              <T name="tiktok" label="TikTok" v={v} />
            </div>
          </Panel>
          <Panel title="Affichage du catalogue">
            <div className="grid gap-4">
              <fieldset>
                <legend className={field.label}>Produits indisponibles</legend>
                <label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" name="unavailableBehavior" value="show" defaultChecked={v.unavailableBehavior !== "hide"} className="accent-navy" /> Les montrer avec la mention « Indisponible »</label>
                <label className="mt-1 flex items-center gap-2 text-sm"><input type="radio" name="unavailableBehavior" value="hide" defaultChecked={v.unavailableBehavior === "hide"} className="accent-navy" /> Les masquer du catalogue public</label>
              </fieldset>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="showReferences" value="1" defaultChecked={!!v.showReferences} className="h-4 w-4 accent-navy" /> Afficher les références sur le site</label>
              <label className={field.label}>
                Devise
                <select name="currency" defaultValue={(v.currency as string) ?? "EUR"} className={field.input}>
                  <option value="EUR">Euro (€)</option>
                  <option value="CHF">Franc suisse</option>
                  <option value="USD">Dollar US</option>
                  <option value="GBP">Livre sterling</option>
                </select>
              </label>
            </div>
          </Panel>
          <Panel title="Pages légales">
            <div className="grid gap-4">
              <T name="legalNotice" label="Mentions légales" v={v} area={5} />
              <T name="privacyPolicy" label="Politique de confidentialité" v={v} area={5} />
            </div>
          </Panel>
        </div>
        <div className="sticky bottom-0 -mx-4 border-t border-line bg-[#f7f5f1]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <button className={`${btn.base} ${btn.primary} ${btn.lg}`} disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer les paramètres"}</button>
        </div>
      </form>

      <Panel title="Mot de passe administrateur">
        <form action={pwAction} className="flex flex-wrap items-end gap-3">
          <label className={field.label}>Mot de passe actuel<input name="current" type="password" autoComplete="current-password" required className={field.input} /></label>
          <label className={field.label}>Nouveau (10 caractères min.)<input name="next" type="password" autoComplete="new-password" minLength={10} required className={field.input} /></label>
          <button className={`${btn.base} ${btn.secondary} ${btn.md}`} disabled={pwPending}>Changer</button>
        </form>
      </Panel>
    </div>
  );
}
