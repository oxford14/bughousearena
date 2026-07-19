"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useSuperAdmin } from "@/lib/admin/use-super-admin";

export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { superAdmin, loading } = useSuperAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !superAdmin) {
      router.replace("/app/home");
    }
  }, [loading, superAdmin, router]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!superAdmin) return null;

  return <>{children}</>;
}
