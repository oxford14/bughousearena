"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle2,
  Coins,
  CreditCard,
  Loader2,
  QrCode,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  COIN_PACKS,
  FIRST_TOPUP_BONUS_RATE,
  formatPhpFromCentavos,
  getTopUpTotalCoins,
  type CoinPack,
} from "@/lib/shop/coin-packs";
import {
  confirmCoinPurchase,
  createCoinCheckout,
  createCoinQrph,
  type CreateQrphResult,
} from "@/lib/shop/checkout";
import { formatCallableError } from "@/lib/firebase/callable-errors";
import { useAuth } from "@/providers/auth-provider";
import type { UserProfile } from "@/types/firestore";
import { cn } from "@/lib/utils";

interface ArenaTopUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile | null;
}

const POLL_INTERVAL_MS = 2500;

type QrSession = CreateQrphResult & { pack: CoinPack };

export function ArenaTopUpDialog({
  open,
  onOpenChange,
  profile,
}: ArenaTopUpDialogProps) {
  const { refreshProfile } = useAuth();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [redirectingId, setRedirectingId] = useState<string | null>(null);
  const [qr, setQr] = useState<QrSession | null>(null);
  const [paid, setPaid] = useState<{ coins: number; bonus: number } | null>(
    null
  );
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const settledRef = useRef(false);

  const coins = profile?.arenaCoins ?? 0;
  const usedBonusPackIds = profile?.firstTopUpBonusUsedPackIds;

  const resetFlow = useCallback(() => {
    settledRef.current = false;
    setQr(null);
    setPaid(null);
    setSecondsLeft(null);
    setLoadingId(null);
    setRedirectingId(null);
  }, []);

  const handleGenerateQr = async (pack: CoinPack) => {
    setLoadingId(pack.id);
    try {
      const result = await createCoinQrph(pack.id);
      settledRef.current = false;
      setPaid(null);
      setQr({ ...result, pack });
    } catch (error) {
      toast.error(formatCallableError(error, "Could not generate QR code."));
    } finally {
      setLoadingId(null);
    }
  };

  const handleHostedCheckout = async (pack: CoinPack) => {
    setRedirectingId(pack.id);
    try {
      const { checkoutUrl } = await createCoinCheckout(pack.id);
      window.location.href = checkoutUrl;
    } catch (error) {
      toast.error(formatCallableError(error, "Could not start checkout."));
      setRedirectingId(null);
    }
  };

  useEffect(() => {
    if (!qr || paid) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled || settledRef.current) return;
      try {
        const result = await confirmCoinPurchase(qr.purchaseId);
        if (cancelled || settledRef.current) return;
        if (result.status === "paid") {
          settledRef.current = true;
          setPaid({
            coins: result.coins ?? qr.pack.coins,
            bonus: result.bonusCoins ?? 0,
          });
          await refreshProfile();
          return;
        }
      } catch {
        /* keep polling */
      }
      if (!cancelled && !settledRef.current) {
        window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    };

    const timer = window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [qr, paid, refreshProfile]);

  useEffect(() => {
    if (!qr?.expiresAt || paid) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.round((qr.expiresAt! - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [qr, paid]);

  useEffect(() => {
    if (!open) resetFlow();
  }, [open, resetFlow]);

  const expired = secondsLeft === 0 && !paid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl border-accent/30 bg-popover max-h-[85vh] overflow-hidden flex flex-col">
        {qr ? (
          <QrPanel
            qr={qr}
            paid={paid}
            secondsLeft={secondsLeft}
            expired={expired}
            onBack={resetFlow}
            onRegenerate={() => void handleGenerateQr(qr.pack)}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading text-xl">
                <Coins className="h-5 w-5 text-accent" aria-hidden />
                Top Up Coins
              </DialogTitle>
              <DialogDescription>
                Scan an in-app QRPh code with any bank or e-wallet app. Balance:{" "}
                <span className="font-medium text-accent">{coins}</span>
                {" · "}
                <span className="text-accent/90">
                  +{Math.round(FIRST_TOPUP_BONUS_RATE * 100)}% bonus on your first
                  purchase of each pack
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 overflow-y-auto min-h-0 pt-1 sm:grid-cols-3">
              {COIN_PACKS.map((pack) => {
                const loading = loadingId === pack.id;
                const redirecting = redirectingId === pack.id;
                const { base, bonus, total } = getTopUpTotalCoins(
                  pack,
                  usedBonusPackIds
                );
                const hasBonus = bonus > 0;
                const busy = loadingId !== null || redirectingId !== null;

                return (
                  <article
                    key={pack.id}
                    className={cn(
                      "topup-pack-card relative flex flex-col rounded-xl border p-3",
                      pack.featured
                        ? "border-primary/40 bg-primary/5"
                        : "border-accent/20 bg-accent/5"
                    )}
                  >
                    {pack.featured && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
                        Popular
                      </span>
                    )}

                    <div className="mb-3 flex flex-1 flex-col items-center text-center pt-1">
                      <Coins className="mb-1 h-5 w-5 text-accent" aria-hidden />
                      <p className="font-heading text-2xl leading-none text-foreground">
                        {base}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Arena Coins
                      </p>

                      {hasBonus && (
                        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-400">
                          <Sparkles className="h-3 w-3" aria-hidden />
                          +{bonus} first top-up
                        </p>
                      )}

                      {hasBonus && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          You receive {total} total
                        </p>
                      )}

                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {pack.description}
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      className="w-full shrink-0"
                      disabled={busy}
                      onClick={() => void handleGenerateQr(pack)}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <>
                          <QrCode className="h-4 w-4" aria-hidden />
                          {formatPhpFromCentavos(pack.amountCentavos)}
                        </>
                      )}
                    </Button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleHostedCheckout(pack)}
                      className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-accent disabled:opacity-50 cursor-pointer"
                    >
                      {redirecting ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      ) : (
                        <CreditCard className="h-3 w-3" aria-hidden />
                      )}
                      Card / GCash
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QrPanel({
  qr,
  paid,
  secondsLeft,
  expired,
  onBack,
  onRegenerate,
  onDone,
}: {
  qr: QrSession;
  paid: { coins: number; bonus: number } | null;
  secondsLeft: number | null;
  expired: boolean;
  onBack: () => void;
  onRegenerate: () => void;
  onDone: () => void;
}) {
  if (paid) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-400" aria-hidden />
        <div className="space-y-1">
          <h2 className="font-heading text-2xl">Payment received</h2>
          <p className="flex items-center justify-center gap-2 text-muted-foreground">
            <Coins className="h-4 w-4 text-accent" aria-hidden />
            <span>
              <span className="font-medium text-accent">+{paid.coins}</span>{" "}
              coins added
            </span>
          </p>
          {paid.bonus > 0 && (
            <p className="flex items-center justify-center gap-1.5 text-sm text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Includes +{paid.bonus} first top-up bonus
            </p>
          )}
        </div>
        <Button onClick={onDone} className="cursor-pointer">
          Done
        </Button>
      </div>
    );
  }

  const minutes = secondsLeft != null ? Math.floor(secondsLeft / 60) : null;
  const secs = secondsLeft != null ? secondsLeft % 60 : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-heading text-xl">
          <QrCode className="h-5 w-5 text-accent" aria-hidden />
          Scan to Pay
        </DialogTitle>
        <DialogDescription>
          Open any bank or e-wallet app (GCash, Maya, etc.), scan the QRPh code
          below, and pay {formatPhpFromCentavos(qr.amountCentavos)} for{" "}
          {qr.pack.coins} coins.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col items-center gap-4 py-2">
        <div className="relative rounded-2xl border border-accent/30 bg-white p-4">
          {expired ? (
            <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-3 text-center text-neutral-500">
              <p className="text-sm font-medium">This QR code expired.</p>
              <Button size="sm" onClick={onRegenerate} className="cursor-pointer">
                Generate a new code
              </Button>
            </div>
          ) : (
            <Image
              src={qr.qrImageUrl}
              alt="QRPh code — scan to pay"
              width={220}
              height={220}
              unoptimized
              className="h-[220px] w-[220px]"
            />
          )}
        </div>

        {!expired && (
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
              Waiting for payment…
            </p>
            {secondsLeft != null && (
              <p className="text-xs text-muted-foreground">
                Code expires in{" "}
                <span className="font-medium text-foreground">
                  {minutes}:{String(secs).padStart(2, "0")}
                </span>
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Ref: {qr.referenceNumber}
            </p>
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Choose another pack
      </Button>
    </>
  );
}
