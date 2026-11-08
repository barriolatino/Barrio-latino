import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Installation · Administration", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await db.adminUser.count()) > 0) redirect("/admin/login");
  const configured = !!process.env.ADMIN_SETUP_CODE;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-paper p-6 shadow-sm sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.webp" alt="" width={64} height={40} className="h-10 w-auto" />
        <h1 className="mt-4 text-2xl font-bold">Créer le compte administrateur</h1>
        {configured ? (
          <>
            <p className="mt-1 text-sm text-ink-muted">Une seule fois. Ensuite, cette page se désactive.</p>
            <SetupForm />
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            Ajoutez d&apos;abord la variable <strong>ADMIN_SETUP_CODE</strong> dans les réglages de l&apos;hébergeur (Vercel › Environment Variables), puis redéployez.
          </p>
        )}
      </div>
    </div>
  );
}
