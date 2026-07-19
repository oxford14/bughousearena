"use client";

import Link from "next/link";
import { ShieldCheck, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSuperAdmin } from "@/lib/admin/use-super-admin";

export function SuperAdminProfileLink() {
  const { superAdmin, loading } = useSuperAdmin();

  if (loading || !superAdmin) return null;

  return (
    <Link href="/app/superadmin" className="block cursor-pointer">
      <Card className="arena-card border-primary/40 bg-primary/5 transition-colors hover:bg-primary/10">
        <div className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm text-foreground">Super Admin Console</p>
            <p className="text-xs text-muted-foreground">
              Manage players, withdrawals, and analytics
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>
      </Card>
    </Link>
  );
}
