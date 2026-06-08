"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { HomeScene } from "@/components/arena/home/home-scene";
import { HomeHub } from "@/components/arena/home/home-hub";
import { ArenaShopDialog } from "@/components/arena/shop/arena-shop-dialog";
import { ArenaTopUpDialog } from "@/components/arena/shop/arena-topup-dialog";
import { useAuth } from "@/providers/auth-provider";
import { useLobbyMusic } from "@/hooks/use-lobby-music";

export default function HomePage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  useLobbyMusic();
  const [shopOpen, setShopOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const cancelToastShown = useRef(false);

  useEffect(() => {
    if (searchParams.get("shop") !== "cancelled") return;
    if (cancelToastShown.current) return;
    cancelToastShown.current = true;
    toast.message("Purchase cancelled");
  }, [searchParams]);

  return (
    <>
      <HomeScene>
        <HomeHub
          profile={profile}
          onOpenShop={() => setShopOpen(true)}
          onOpenTopUp={() => setTopUpOpen(true)}
        />
      </HomeScene>

      <ArenaShopDialog
        open={shopOpen}
        onOpenChange={setShopOpen}
        profile={profile}
        initialTab="board"
        onTopUpRequest={() => setTopUpOpen(true)}
      />

      <ArenaTopUpDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        profile={profile}
      />
    </>
  );
}
