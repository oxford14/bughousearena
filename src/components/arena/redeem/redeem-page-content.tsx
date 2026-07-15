"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Banknote, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REDEEM_BUNDLES } from "@/lib/wallet/redeem-bundles";
import {
  checkRedeemEligibility,
  requestRedemption,
} from "@/lib/wallet/wallet-api";
import { useAuth } from "@/providers/auth-provider";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type { RedemptionRequest } from "@/types/wallet";
import { toast } from "sonner";

export default function RedeemPageContent() {
  const { user, profile, refreshProfile } = useAuth();
  const [eligible, setEligible] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [selectedBundle, setSelectedBundle] = useState(REDEEM_BUNDLES[0]!.id);
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashName, setGcashName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<(RedemptionRequest & { id: string })[]>([]);

  useEffect(() => {
    void checkRedeemEligibility()
      .then((r) => {
        setEligible(r.eligible);
        setReasons(r.reasons);
      })
      .catch(() => {});
  }, [profile?.completedMatches, profile?.arenaCoins]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(getFirebaseDb(), "redemptionRequests"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setHistory(
        snap.docs.map((d) => ({ ...(d.data() as RedemptionRequest), id: d.id }))
      );
    });
  }, [user]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await requestRedemption({
        bundleId: selectedBundle,
        gcashNumber,
        gcashName,
      });
      await refreshProfile();
      toast.success("Redemption request submitted! We'll process it within 24–48 hours.");
      setGcashNumber("");
      setGcashName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const bundle = REDEEM_BUNDLES.find((b) => b.id === selectedBundle)!;

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-3xl neon-glow flex items-center gap-2">
          <Banknote className="h-8 w-8" />
          Redeem
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Convert Arena Coins to GCash. Skill-based rewards — not gambling.
        </p>
      </motion.div>

      <Card className="arena-card border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">Your balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-heading text-3xl text-primary">
            {(profile?.arenaCoins ?? 0).toLocaleString()} coins
          </p>
        </CardContent>
      </Card>

      <Card className="arena-card border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">Eligibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {eligible ? (
            <p className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> You&apos;re eligible to redeem.
            </p>
          ) : (
            reasons.map((reason) => (
              <p key={reason} className="flex items-start gap-2 text-sm text-muted-foreground">
                <XCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                {reason}
              </p>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="arena-card border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">Redemption bundles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {REDEEM_BUNDLES.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedBundle(b.id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                selectedBundle === b.id
                  ? "border-primary bg-primary/10"
                  : "border-primary/20 hover:border-primary/40"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-heading">{b.label}</span>
                <span className="text-primary font-medium">₱{b.phpAmount.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{b.description}</p>
            </button>
          ))}

          <div className="space-y-3 pt-2">
            <div>
              <Label htmlFor="gcash-name">GCash account name</Label>
              <Input
                id="gcash-name"
                value={gcashName}
                onChange={(e) => setGcashName(e.target.value)}
                placeholder="Juan Dela Cruz"
              />
            </div>
            <div>
              <Label htmlFor="gcash-number">GCash mobile number</Label>
              <Input
                id="gcash-number"
                value={gcashNumber}
                onChange={(e) => setGcashNumber(e.target.value)}
                placeholder="09XX XXX XXXX"
              />
            </div>
            <Button
              className="w-full btn-arena-primary"
              disabled={!eligible || submitting || (profile?.arenaCoins ?? 0) < bundle.coins}
              onClick={handleSubmit}
            >
              Redeem {bundle.coins.toLocaleString()} coins → ₱{bundle.phpAmount}
            </Button>
          </div>
        </CardContent>
      </Card>

      {history.length > 0 ? (
        <Card className="arena-card border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Request history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((req) => (
              <div
                key={req.id}
                className="flex justify-between items-center rounded-lg border border-primary/15 px-3 py-2 text-sm"
              >
                <span>
                  ₱{req.phpAmount} · {req.status}
                </span>
                <span className="text-muted-foreground">{req.coins} coins</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
