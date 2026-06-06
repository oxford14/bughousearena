"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsStandalone } from "@/hooks/use-is-standalone";

export function StandaloneRedirect() {
  const isStandalone = useIsStandalone();
  const router = useRouter();

  useEffect(() => {
    if (isStandalone) {
      router.replace("/app/loader");
    }
  }, [isStandalone, router]);

  return null;
}
