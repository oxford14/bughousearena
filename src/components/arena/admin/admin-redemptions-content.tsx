"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listPendingRedemptions, processRedemption } from "@/lib/wallet/wallet-api";
import { isUserAdmin } from "@/lib/wallet/admin-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function AdminRedemptionsContent() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<
    Array<{
      id: string;
      uid: string;
      bundleId: string;
      coins: number;
      phpAmount: number;
      gcashNumber: string;
      gcashName: string;
      status: string;
      createdAt: string | null;
    }>
  >([]);

  useEffect(() => {
    void isUserAdmin().then((admin) => {
      setAllowed(admin);
      if (!admin) router.replace("/app/home");
    });
  }, [router]);

  useEffect(() => {
    if (!allowed) return;
    void listPendingRedemptions()
      .then((r) => setRequests(r.requests))
      .catch(() => {});
  }, [allowed]);

  const handleAction = async (requestId: string, action: "paid" | "reject") => {
    try {
      await processRedemption(requestId, action);
      toast.success(action === "paid" ? "Marked as paid." : "Rejected and refunded.");
      const r = await listPendingRedemptions();
      setRequests(r.requests);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    }
  };

  if (allowed === null) {
    return <p className="text-center text-muted-foreground p-8">Checking access...</p>;
  }

  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <h1 className="font-heading text-3xl neon-glow">Redemption Admin</h1>
      <p className="text-sm text-muted-foreground">
        Send GCash manually, then mark as paid. Rejecting refunds coins automatically.
      </p>

      {requests.length === 0 ? (
        <Card className="arena-card p-6 text-center text-muted-foreground">
          No pending requests.
        </Card>
      ) : (
        requests.map((req) => (
          <Card key={req.id} className="arena-card border-primary/20">
            <CardHeader>
              <CardTitle className="text-base">
                ₱{req.phpAmount} — {req.coins} coins
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">GCash:</span> {req.gcashName} ·{" "}
                {req.gcashNumber}
              </p>
              <p>
                <span className="text-muted-foreground">User:</span> {req.uid}
              </p>
              <p>
                <span className="text-muted-foreground">Bundle:</span> {req.bundleId}
              </p>
              <div className="flex gap-2 pt-2">
                <Button
                  className="btn-arena-primary flex-1"
                  onClick={() => handleAction(req.id, "paid")}
                >
                  Mark paid
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleAction(req.id, "reject")}
                >
                  Reject & refund
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
