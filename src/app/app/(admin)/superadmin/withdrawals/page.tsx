"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Banknote, Send } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  listWithdrawals,
  payWithdrawal,
  resolveWithdrawal,
  type AdminWithdrawal,
} from "@/lib/admin/admin-api";

const STATUS_TABS = [
  { id: "pending", label: "Pending" },
  { id: "processing", label: "Processing" },
  { id: "paid", label: "Paid" },
  { id: "failed", label: "Failed" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  processing: "default",
  paid: "default",
  failed: "destructive",
  rejected: "destructive",
};

export default function SuperAdminWithdrawalsPage() {
  const [tab, setTab] = useState<string>("pending");
  const [items, setItems] = useState<AdminWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const { withdrawals } = await listWithdrawals(status);
      setItems(withdrawals);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load withdrawals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  const handlePay = async (item: AdminWithdrawal) => {
    if (
      !window.confirm(
        `Send ₱${item.phpAmount} via PayMongo to ${item.gcashName} (${item.gcashNumber})?\n\nThis moves real money and cannot be undone.`
      )
    )
      return;
    setBusyId(item.id);
    try {
      await payWithdrawal(item.id);
      toast.success("Payout submitted. Awaiting PayMongo confirmation.");
      await load(tab);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payout failed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleResolve = async (
    item: AdminWithdrawal,
    action: "paid" | "reject"
  ) => {
    const label = action === "paid" ? "mark as paid manually" : "reject & refund";
    if (!window.confirm(`Are you sure you want to ${label} this request?`)) return;
    setBusyId(item.id);
    try {
      await resolveWithdrawal({ requestId: item.id, action });
      toast.success(action === "paid" ? "Marked as paid." : "Rejected and refunded.");
      await load(tab);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-3xl neon-glow">Withdrawals</h1>
        <p className="text-sm text-muted-foreground">
          Review redemption requests and pay them out to GCash via PayMongo.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
              tab === t.id
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
      ) : items.length === 0 ? (
        <Card className="arena-card p-6 text-center text-muted-foreground">
          No {tab === "all" ? "" : tab} requests.
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.id} className="arena-card border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">
                ₱{item.phpAmount.toLocaleString()} — {item.coins} coins
              </CardTitle>
              <Badge variant={STATUS_VARIANT[item.status] ?? "secondary"}>
                {item.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Player:</span>{" "}
                {item.displayName}
                {item.email ? ` · ${item.email}` : ""}
              </p>
              <p>
                <span className="text-muted-foreground">GCash:</span>{" "}
                {item.gcashName} · {item.gcashNumber}
              </p>
              {item.paymongoTransferId && (
                <p className="truncate">
                  <span className="text-muted-foreground">Transfer:</span>{" "}
                  {item.paymongoTransferId}
                </p>
              )}
              {item.adminNote && (
                <p>
                  <span className="text-muted-foreground">Note:</span>{" "}
                  {item.adminNote}
                </p>
              )}

              {item.status === "pending" && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    className="btn-arena-primary"
                    disabled={busyId === item.id}
                    onClick={() => void handlePay(item)}
                  >
                    {busyId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Pay via PayMongo
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busyId === item.id}
                    onClick={() => void handleResolve(item, "paid")}
                  >
                    <Banknote className="h-4 w-4" />
                    Mark paid (manual)
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busyId === item.id}
                    onClick={() => void handleResolve(item, "reject")}
                  >
                    Reject & refund
                  </Button>
                </div>
              )}

              {item.status === "processing" && (
                <p className="pt-1 text-xs text-muted-foreground">
                  Awaiting PayMongo confirmation. Status updates automatically
                  when the transfer completes.
                </p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
