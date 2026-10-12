import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Mot de passe oublié · Administration", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function ResetPage() {
  const configured = !!process.env.ADMIN_SETUP_CODE?.trim();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-paper p-6 shadow-sm sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.webp" alt="" width={64} height={40} className="h-10 w-auto" />
        <h1 className="mt-4 text-2xl font-bold">Mot de passe oublié</h1>
        {configured ? (
          <>
            <p className="mt-1 text-sm text-ink-muted">Saisissez le code de récupération enregistré dans Vercel, puis choisissez un nouveau mot de passe.</p>
            <ResetForm />
          </>
        ) : (
          <div className="mt-3 space-y-2 text-sm text-ink-muted">
            <p>Pour des raisons de sécurité, la récupération passe par l&apos;hébergeur :</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Dans Vercel › Environment Variables, ajoutez <strong>ADMIN_SETUP_CODE</strong> avec un code de votre choix.</li>
              <li>Redéployez (Deployments › ⋯ › Redeploy).</li>
              <li>Revenez sur cette page.</li>
            </ol>
          </div>
        )}
        <p className="mt-6 text-center text-sm">
          <Link href="/admin/login" className="text-navy underline underline-offset-4">Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
