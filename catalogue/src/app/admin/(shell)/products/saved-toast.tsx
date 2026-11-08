"use client";

import { useEffect } from "react";
import { toast } from "@/components/admin/toast";

export function SavedToast({ text }: { text: string }) {
  useEffect(() => {
    toast(text);
  }, [text]);
  return null;
}
