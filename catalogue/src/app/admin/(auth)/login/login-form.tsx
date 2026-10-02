"use client";

import { useActionState } from "react";
import { loginAction } from "../../actions/auth";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const input = "mt-1 h-12 w-full rounded-[var(--radius-control)] border border-line-strong bg-paper px-3 text-base focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15";
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium">
        E-mail
        <input name="email" type="email" autoComplete="username" required className={input} />
      </label>
      <label className="block text-sm font-medium">
        Mot de passe
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-[var(--radius-control)] bg-danger-bg px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="h-12 w-full rounded-full bg-navy font-semibold text-white hover:bg-navy-soft disabled:opacity-60">
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
