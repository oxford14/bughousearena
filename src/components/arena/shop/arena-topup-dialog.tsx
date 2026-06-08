"use client";

import { useState } from "react";
import { Coins, Loader2, Sparkles } from "lucide-react";
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
import { createCoinCheckout } from "@/lib/shop/checkout";
import { formatCallableError } from "@/lib/firebase/callable-errors";
import type { UserProfile } from "@/types/firestore";
import { cn } from "@/lib/utils";

interface ArenaTopUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile | null;
}

export function ArenaTopUpDialog({
  open,
  onOpenChange,
  profile,
}: ArenaTopUpDialogProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const coins = profile?.arenaCoins ?? 0;
  const usedBonusPackIds = profile?.firstTopUpBonusUsedPackIds;

  const handleTopUp = async (pack: CoinPack) => {
    setLoadingId(pack.id);
    try {
      const { checkoutUrl } = await createCoinCheckout(pack.id);
      window.location.href = checkoutUrl;
    } catch (error) {
      toast.error(formatCallableError(error, "Could not start checkout."));
      setLoadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl border-accent/30 bg-popover max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-xl">
            <Coins className="h-5 w-5 text-accent" aria-hidden />
            Top Up Coins
          </DialogTitle>
          <DialogDescription>
            Pay securely with PayMongo (card, GCash, QRPh). Balance:{" "}
            <span className="font-medium text-accent">{coins}</span>
            {" · "}
            <span className="text-accent/90">
              +{Math.round(FIRST_TOPUP_BONUS_RATE * 100)}% bonus on your first purchase of each pack
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 overflow-y-auto min-h-0 pt-1 sm:grid-cols-3">
          {COIN_PACKS.map((pack) => {
            const loading = loadingId === pack.id;
            const { base, bonus, total } = getTopUpTotalCoins(pack, usedBonusPackIds);
            const hasBonus = bonus > 0;

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
                  <p className="font-heading text-2xl leading-none text-foreground">{base}</p>
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

                  <p className="mt-2 text-[10px] text-muted-foreground">{pack.description}</p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  className="w-full shrink-0"
                  disabled={loadingId !== null}
                  onClick={() => void handleTopUp(pack)}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    formatPhpFromCentavos(pack.amountCentavos)
                  )}
                </Button>
              </article>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
