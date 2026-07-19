"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listTransactions } from "@/lib/admin/admin-api";
import type { AdminTransaction } from "@/app/api/admin/transactions/list/route";

const TYPE_FILTERS = [
  { id: "", label: "All" },
  { id: "topup", label: "Top-ups" },
  { id: "shop_purchase", label: "Shop" },
  { id: "stake_win", label: "Stake wins" },
  { id: "daily_bonus", label: "Daily" },
  { id: "referral", label: "Referral" },
  { id: "redeem_lock", label: "Redeems" },
  { id: "admin_adjust", label: "Admin" },
] as const;

export default function SuperAdminTransactionsPage() {
  const [type, setType] = useState("");
  const [rows, setRows] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const { transactions } = await listTransactions(t ? { type: t } : undefined);
      setRows(transactions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(type);
  }, [type, load]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-3xl neon-glow">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Recent coin ledger activity (latest 100).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
              type === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="arena-card p-6 text-center text-muted-foreground">
          No transactions.
        </Card>
      ) : (
        <Card className="arena-card border-primary/20 divide-y divide-border/60">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {row.displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.type} ·{" "}
                  {row.createdAt
                    ? new Date(row.createdAt).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "font-heading",
                    row.amount >= 0 ? "text-emerald-400" : "text-destructive"
                  )}
                >
                  {row.amount >= 0 ? "+" : ""}
                  {row.amount}
                </p>
                <p className="text-xs text-muted-foreground">
                  bal {row.balanceAfter}
                </p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
