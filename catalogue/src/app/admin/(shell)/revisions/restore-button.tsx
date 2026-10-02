"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "@/components/admin/toast";
import { btn } from "@/components/ui";
import { restoreRevisionAction } from "../../actions/products";

export function RestoreButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className={`${btn.base} ${btn.secondary} ${btn.sm}`}
      disabled={pending}
      onClick={() =>
        confirm("Restaurer cette version du produit ?") &&
        start(async () => {
          const res = await restoreRevisionAction(id);
          if (!res.ok) return toast(res.error, "error");
          toast(res.message ?? "Restauré");
          router.refresh();
        })
      }
    >
      Restaurer cette version
    </button>
  );
}
