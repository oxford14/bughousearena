"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Coins,
  Banknote,
  Clock,
  TrendingUp,
  Trophy,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { getAdminStats } from "@/lib/admin/admin-api";
import type { AdminStats } from "@/app/api/admin/stats/route";
import { formatPhpFromCentavos } from "@/lib/shop/coin-packs";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <Card className="arena-card border-primary/20 h-full p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="font-heading text-2xl text-foreground">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
    </Card>
  );

  return href ? (
    <Link href={href} className="block cursor-pointer">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAdminStats()
      .then(setStats)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load stats.")
      );
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-3xl neon-glow">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live overview of the arena economy.
        </p>
      </div>

      {error ? (
        <Card className="arena-card border-destructive/40 p-6 text-center text-destructive">
          {error}
        </Card>
      ) : !stats ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={Users}
            label="Players"
            value={stats.players.toLocaleString()}
            href="/app/superadmin/players"
          />
          <StatCard
            icon={Coins}
            label="Coins in circulation"
            value={stats.coinsInCirculation.toLocaleString()}
          />
          <StatCard
            icon={TrendingUp}
            label="Revenue (paid top-ups)"
            value={formatPhpFromCentavos(stats.revenueCentavos)}
          />
          <StatCard
            icon={Clock}
            label="Pending withdrawals"
            value={stats.pendingWithdrawalsCount.toLocaleString()}
            hint={`₱${stats.pendingWithdrawalsPhp.toLocaleString()} to pay`}
            href="/app/superadmin/withdrawals"
          />
          <StatCard
            icon={Banknote}
            label="Total paid out"
            value={`₱${stats.totalPaidOutPhp.toLocaleString()}`}
            hint={
              stats.processingWithdrawalsCount > 0
                ? `${stats.processingWithdrawalsCount} processing`
                : undefined
            }
          />
          <StatCard
            icon={Trophy}
            label="Active tournaments"
            value={stats.activeTournaments.toLocaleString()}
            href="/app/superadmin/tournaments"
          />
        </div>
      )}
    </div>
  );
}
