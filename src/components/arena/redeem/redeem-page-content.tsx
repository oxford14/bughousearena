"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Banknote, CheckCircle2, ChevronDown, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REDEEM_BUNDLES } from "@/lib/wallet/redeem-bundles";
import {
  checkRedeemEligibility,
  requestRedemption,
} from "@/lib/wallet/wallet-api";
import {
  PAYOUT_METHODS,
  PH_BANKS,
  formatPayoutAccountNumber,
  formatPayoutMethodLabel,
  getDigitProgress,
  getPayoutMethodConfig,
  stripAccountDigits,
  validatePayoutDestination,
  type PayoutMethod,
} from "@/lib/wallet/payout-methods";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function RedeemPageContent() {
  const { user, profile, refreshProfile } = useAuth();
  const [eligible, setEligible] = useState(false);
  const [bypassed, setBypassed] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [selectedBundle, setSelectedBundle] = useState(REDEEM_BUNDLES[0]!.id);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("gcash");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<(RedemptionRequest & { id: string })[]>([]);

  const methodConfig = getPayoutMethodConfig(payoutMethod);
  const digitProgress = getDigitProgress(payoutMethod, accountNumber);

  useEffect(() => {
    void checkRedeemEligibility()
      .then((r) => {
        setEligible(r.eligible);
        setReasons(r.reasons);
        setBypassed(Boolean(r.bypassed));
      })
      .catch(() => {});
  }, [profile?.rankedWins, profile?.rankedLosses, profile?.arenaCoins]);

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

  const formError = useMemo(
    () =>
      validatePayoutDestination({
        method: payoutMethod,
        accountName,
        accountNumber,
        bankName,
      }),
    [payoutMethod, accountName, accountNumber, bankName]
  );

  const handleMethodChange = (method: PayoutMethod) => {
    setPayoutMethod(method);
    setAccountNumber("");
    if (method !== "bank") setBankName("");
  };

  const handleNumberChange = (value: string) => {
    const raw = stripAccountDigits(value);
    const max = methodConfig?.digits ?? methodConfig?.maxDigits ?? 12;
    if (raw.length > max) return;
    setAccountNumber(formatPayoutAccountNumber(payoutMethod, raw));
  };

  const handleSubmit = async () => {
    if (formError) {
      toast.error(formError);
      return;
    }
    setSubmitting(true);
    try {
      await requestRedemption({
        bundleId: selectedBundle,
        payoutMethod,
        accountName: accountName.trim(),
        accountNumber: stripAccountDigits(accountNumber),
        ...(payoutMethod === "bank" ? { bankName: bankName.trim() } : {}),
      });
      await refreshProfile();
      toast.success(
        "Redemption request submitted! We'll process it within 24–48 hours."
      );
      setAccountName("");
      setAccountNumber("");
      setBankName("");
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
          Convert Arena Coins to GCash, Maya, or bank. Skill-based rewards — not
          gambling.
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
              <CheckCircle2 className="h-4 w-4" />{" "}
              {bypassed
                ? "Super admin — play requirements waived."
                : "You're eligible to redeem."}
            </p>
          ) : (
            reasons.map((reason) => (
              <p
                key={reason}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
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
                <span className="text-primary font-medium">
                  ₱{b.phpAmount.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{b.description}</p>
            </button>
          ))}

          <div className="space-y-3 pt-2 border-t border-primary/15">
            <div>
              <Label htmlFor="payout-method">Payout method</Label>
              <div className="relative mt-1">
                <select
                  id="payout-method"
                  value={payoutMethod}
                  onChange={(e) =>
                    handleMethodChange(e.target.value as PayoutMethod)
                  }
                  className="w-full appearance-none rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer"
                >
                  {PAYOUT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              {methodConfig && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {methodConfig.hint}
                </p>
              )}
            </div>

            {payoutMethod === "bank" && (
              <div>
                <Label htmlFor="bank-name">Bank</Label>
                <div className="relative mt-1">
                  <select
                    id="bank-name"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer"
                  >
                    <option value="">Select your bank</option>
                    {PH_BANKS.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="account-name">
                {methodConfig?.nameLabel ?? "Account name"}
              </Label>
              <Input
                id="account-name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Juan Dela Cruz"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="account-number">
                  {methodConfig?.numberLabel ?? "Account number"}
                </Label>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    digitProgress.complete
                      ? "text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  {digitProgress.label}
                </span>
              </div>
              <Input
                id="account-number"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => handleNumberChange(e.target.value)}
                placeholder={methodConfig?.placeholder}
                className="font-mono tracking-wide"
              />
            </div>

            <Button
              className="w-full btn-arena-primary"
              disabled={
                !eligible ||
                submitting ||
                Boolean(formError) ||
                (profile?.arenaCoins ?? 0) < bundle.coins
              }
              onClick={() => void handleSubmit()}
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
                  ₱{req.phpAmount} · {req.status} ·{" "}
                  {formatPayoutMethodLabel(
                    req.payoutMethod ?? "gcash",
                    req.bankName
                  )}
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
