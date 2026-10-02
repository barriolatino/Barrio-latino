import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion · Administration", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-paper p-6 shadow-sm sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.webp" alt="" width={64} height={40} className="h-10 w-auto" />
        <h1 className="mt-4 text-2xl font-bold">Administration du catalogue</h1>
        <p className="mt-1 text-sm text-ink-muted">Connectez-vous pour modifier les produits et les prix.</p>
        <LoginForm next={next ?? "/admin"} />
      </div>
    </div>
  );
}
