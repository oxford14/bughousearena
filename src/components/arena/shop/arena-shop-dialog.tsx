"use client";

import { useState } from "react";
import { Coins, Loader2, Lock, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShopItemPreview } from "@/components/arena/shop/shop-item-preview";
import {
  getShopItemsByCategory,
  type ShopCatalogItem,
  type ShopCategory,
} from "@/lib/shop/catalog";
import { purchaseShopItem, equipShopItem } from "@/lib/shop/shop-api";
import { ownsShopItem } from "@/lib/shop/inventory";
import type { UserProfile } from "@/types/firestore";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type ShopTab = ShopCategory;

const TAB_LABELS: Record<ShopTab, string> = {
  board: "Boards",
  piece: "Pieces",
  social: "Social",
  profile: "Profile",
};

interface ArenaShopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile | null;
  initialTab?: ShopTab;
  onTopUpRequest?: () => void;
}

export function ArenaShopDialog({
  open,
  onOpenChange,
  profile,
  initialTab = "board",
  onTopUpRequest,
}: ArenaShopDialogProps) {
  const { refreshProfile } = useAuth();
  const [tab, setTab] = useState<ShopTab>(initialTab);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const coins = profile?.arenaCoins ?? 0;

  const handlePurchase = async (item: ShopCatalogItem) => {
    if (ownsShopItem(profile, item.id)) {
      await handleEquip(item);
      return;
    }
    setLoadingId(item.id);
    try {
      await purchaseShopItem(item.id);
      await refreshProfile();
      toast.success(`Purchased ${item.label}`);
      await handleEquip(item);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Purchase failed.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleEquip = async (item: ShopCatalogItem) => {
    try {
      if (item.category === "board" && item.unlockIds[0]) {
        await equipShopItem("boardTheme", item.unlockIds[0]!);
      } else if (item.category === "piece" && item.unlockIds[0]) {
        await equipShopItem("pieceSet", item.unlockIds[0]!);
      } else if (item.category === "profile" && item.unlockIds[0]) {
        await equipShopItem("avatarFrame", item.unlockIds[0]!);
      } else if (item.category === "social" && item.id === "social_emotes_reactions") {
        const emoteIds = item.unlockIds.filter((id) => id.startsWith("emote_"));
        await equipShopItem("emotes", emoteIds.slice(0, 4));
      }
      await refreshProfile();
      toast.success(`Equipped ${item.label}`);
    } catch {
      /* equip optional after purchase */
    }
  };

  const renderCatalogItem = (item: ShopCatalogItem) => {
    const owned = ownsShopItem(profile, item.id);
    const loading = loadingId === item.id;
    const canAfford = coins >= item.priceCoins;

    return (
      <li
        key={item.id}
        className={cn(
          "shop-item-card flex flex-col rounded-xl border overflow-hidden transition-shadow hover:shadow-[0_4px_20px_rgba(124,58,237,0.12)]",
          owned ? "border-primary/35 bg-primary/5" : "border-border/60 bg-muted/10"
        )}
      >
        <ShopItemPreview item={item} className="rounded-none border-0 border-b border-border/30 bg-muted/20" />

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm text-foreground">{item.label}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {item.description}
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant={owned ? "secondary" : "default"}
            className="w-full shrink-0 gap-1"
            disabled={loadingId !== null || (!owned && !canAfford)}
            onClick={() => void handlePurchase(item)}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : owned ? (
              "Equip"
            ) : (
              <>
                <Coins className="h-3.5 w-3.5" aria-hidden />
                {item.priceCoins}
              </>
            )}
          </Button>
        </div>
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl border-accent/30 bg-popover max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-xl">
            <ShoppingBag className="h-5 w-5 text-accent" aria-hidden />
            Arena Shop
          </DialogTitle>
          <DialogDescription>
            Spend Arena Coins on cosmetics. Balance:{" "}
            <span className="font-medium text-accent">{coins}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1 border-b border-border/50 pb-2">
          {(Object.keys(TAB_LABELS) as ShopTab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pt-2">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            {getShopItemsByCategory(tab).map(renderCatalogItem)}
          </ul>
        </div>

        {coins === 0 ? (
          <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
            <Lock className="h-3 w-3" aria-hidden />
            {onTopUpRequest ? (
              <>
                Need coins?{" "}
                <button
                  type="button"
                  className="text-accent underline underline-offset-2 cursor-pointer"
                  onClick={() => {
                    onOpenChange(false);
                    onTopUpRequest();
                  }}
                >
                  Top up
                </button>
              </>
            ) : (
              "Top up coins from the home screen to purchase items."
            )}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated Use ArenaShopDialog */
export const CoinShopDialog = ArenaShopDialog;
