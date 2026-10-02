import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { Toaster } from "@/components/admin/toast";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "../actions/auth";

export const metadata: Metadata = { title: { default: "Administration", template: "%s · Administration" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh bg-[#f7f5f1] lg:flex">
      <AdminNav email={admin.email} logout={logoutAction} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
      <Toaster />
    </div>
  );
}
