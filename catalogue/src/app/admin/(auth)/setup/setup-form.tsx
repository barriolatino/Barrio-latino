"use client";

import { startTransition, useActionState } from "react";
import { setupAdminAction } from "../../actions/auth";

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAdminAction, null);
  const input = "mt-1 h-12 w-full rounded-[var(--radius-control)] border border-line-strong bg-paper px-3 text-base focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15";
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        // Envoi manuel : après une erreur, les champs gardent leur contenu.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <label className="block text-sm font-medium">
        Code d&apos;installation
        <input name="code" type="password" autoComplete="off" required className={input} />
        <span className="mt-1 block text-xs text-ink-muted">Celui saisi dans Vercel (ADMIN_SETUP_CODE).</span>
      </label>
      <label className="block text-sm font-medium">
        Votre e-mail
        <input name="email" type="email" autoComplete="username" required className={input} />
      </label>
      <label className="block text-sm font-medium">
        Mot de passe (10 caractères minimum)
        <input name="password" type="password" autoComplete="new-password" minLength={10} required className={input} />
      </label>
      {state?.error && <p role="alert" className="rounded-[var(--radius-control)] bg-danger-bg px-3 py-2 text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="h-12 w-full rounded-full bg-navy font-semibold text-white hover:bg-navy-soft disabled:opacity-60">
        {pending ? "Création…" : "Créer mon compte"}
      </button>
    </form>
  );
}
