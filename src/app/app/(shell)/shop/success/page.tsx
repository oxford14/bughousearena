"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Coins, Loader2, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { confirmCoinPurchase } from "@/lib/shop/checkout";
import { useAuth } from "@/providers/auth-provider";

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 20;

function HomeButton({ label }: { label: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={cn(buttonVariants(), "cursor-pointer")}
      onClick={() => router.push("/app/home")}
    >
      {label}
    </button>
  );
}

export default function ShopSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseId = searchParams.get("purchase");
  const { refreshProfile, user } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [baseCoins, setBaseCoins] = useState<number | null>(null);
  const [bonusCoins, setBonusCoins] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    if (!purchaseId) {
      setError("Missing purchase reference.");
      return;
    }
    if (!user) return;

    let cancelled = false;
    let polls = 0;

    const poll = async () => {
      if (cancelled || settledRef.current) return;

      try {
        const result = await confirmCoinPurchase(purchaseId);
        if (cancelled || settledRef.current) return;

        setStatus(result.status);
        if (result.coins != null) setCoins(result.coins);
        if (result.baseCoins != null) setBaseCoins(result.baseCoins);
        if (result.bonusCoins != null) setBonusCoins(result.bonusCoins);

        if (result.status === "paid") {
          settledRef.current = true;
          await refreshProfile();
          return;
        }

        polls += 1;
        if (polls < MAX_POLLS && result.status === "pending") {
          window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) {
          setError("Could not verify your purchase.");
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [purchaseId, user?.uid, refreshProfile]);

  const paid = status === "paid";
  const pending = status === "pending";
  const hasBonus = (bonusCoins ?? 0) > 0;

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      {error ? (
        <>
          <p className="text-destructive">{error}</p>
          <HomeButton label="Back to home" />
        </>
      ) : paid ? (
        <>
          <CheckCircle2 className="h-14 w-14 text-emerald-400" aria-hidden />
          <div className="space-y-2">
            <h1 className="font-heading text-2xl">Purchase complete</h1>
            <p className="flex items-center justify-center gap-2 text-muted-foreground">
              <Coins className="h-4 w-4 text-accent" aria-hidden />
              <span>
                <span className="font-medium text-accent">+{coins}</span> coins added to your
                account
              </span>
            </p>
            {hasBonus && baseCoins !== null && bonusCoins !== null && (
              <p className="flex items-center justify-center gap-1.5 text-sm text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Includes +{bonusCoins} first top-up bonus on {baseCoins} coins
              </p>
            )}
          </div>
          <HomeButton label="Return to home" />
        </>
      ) : pending || status === null ? (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-accent" aria-hidden />
          <div className="space-y-2">
            <h1 className="font-heading text-xl">Confirming payment…</h1>
            <p className="text-sm text-muted-foreground">
              This usually takes a few seconds. Do not close this page.
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">
            Payment status: <span className="font-medium">{status}</span>
          </p>
          <button
            type="button"
            className={cn(buttonVariants(), "cursor-pointer")}
            onClick={() => router.push("/app/home")}
          >
            Back to home
          </button>
        </>
      )}
    </div>
  );
}
