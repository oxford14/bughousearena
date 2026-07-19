"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  Search,
  Loader2,
  Coins,
  Ban,
  ShieldCheck,
  ShieldOff,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listPlayers,
  adjustPlayerCoins,
  setPlayerBan,
  setPlayerRole,
  type AdminPlayer,
} from "@/lib/admin/admin-api";
import { formatPhpFromCentavos } from "@/lib/shop/coin-packs";

export default function SuperAdminPlayersPage() {
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<AdminPlayer | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const { players } = await listPlayers(q);
      setPlayers(players);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load players.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void load(query.trim() || undefined);
  };

  const handleBan = async (player: AdminPlayer) => {
    if (
      !window.confirm(
        `${player.banned ? "Unban" : "Ban"} ${player.displayName}?`
      )
    )
      return;
    setBusyUid(player.uid);
    try {
      await setPlayerBan({ uid: player.uid, banned: !player.banned });
      toast.success(player.banned ? "Player unbanned." : "Player banned.");
      setPlayers((prev) =>
        prev.map((p) =>
          p.uid === player.uid ? { ...p, banned: !player.banned } : p
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyUid(null);
    }
  };

  const handleRole = async (player: AdminPlayer) => {
    if (
      !window.confirm(
        `${player.admin ? "Remove admin from" : "Make admin"} ${player.displayName}?`
      )
    )
      return;
    setBusyUid(player.uid);
    try {
      await setPlayerRole({ uid: player.uid, admin: !player.admin });
      toast.success("Role updated.");
      setPlayers((prev) =>
        prev.map((p) =>
          p.uid === player.uid ? { ...p, admin: !player.admin } : p
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-3xl neon-glow">Players</h1>
        <p className="text-sm text-muted-foreground">
          Search and manage player accounts.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={loading}>
          Search
        </Button>
      </form>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : players.length === 0 ? (
        <Card className="arena-card p-6 text-center text-muted-foreground">
          No players found.
        </Card>
      ) : (
        <div className="space-y-3">
          {players.map((player) => (
            <Card key={player.uid} className="arena-card border-primary/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {player.photoURL ? (
                    <Image
                      src={player.photoURL}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 font-heading text-primary">
                      {player.displayName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-medium text-foreground">
                      {player.displayName}
                      {player.superAdmin && (
                        <Badge className="bg-primary/20 text-primary">Super</Badge>
                      )}
                      {player.admin && !player.superAdmin && (
                        <Badge variant="secondary">Admin</Badge>
                      )}
                      {player.banned && (
                        <Badge variant="destructive">Banned</Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {player.email ?? player.uid}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span className="text-accent">{player.arenaCoins} coins</span>
                      <span>{player.rating} ELO</span>
                      <span>{player.completedMatches} matches</span>
                      {player.totalTopUpCentavos > 0 && (
                        <span>{formatPhpFromCentavos(player.totalTopUpCentavos)} spent</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyUid === player.uid}
                    onClick={() => setAdjustTarget(player)}
                  >
                    <Coins className="h-4 w-4" />
                    Coins
                  </Button>
                  {!player.superAdmin && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyUid === player.uid}
                        onClick={() => void handleRole(player)}
                      >
                        {player.admin ? (
                          <ShieldOff className="h-4 w-4" />
                        ) : (
                          <Shield className="h-4 w-4" />
                        )}
                        {player.admin ? "Unadmin" : "Admin"}
                      </Button>
                      <Button
                        size="sm"
                        variant={player.banned ? "outline" : "destructive"}
                        disabled={busyUid === player.uid}
                        onClick={() => void handleBan(player)}
                      >
                        {player.banned ? (
                          <ShieldCheck className="h-4 w-4" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                        {player.banned ? "Unban" : "Ban"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AdjustCoinsDialog
        player={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onDone={(uid, balanceAfter) => {
          setPlayers((prev) =>
            prev.map((p) =>
              p.uid === uid ? { ...p, arenaCoins: balanceAfter } : p
            )
          );
          setAdjustTarget(null);
        }}
      />
    </div>
  );
}

function AdjustCoinsDialog({
  player,
  onClose,
  onDone,
}: {
  player: AdminPlayer | null;
  onClose: () => void;
  onDone: (uid: string, balanceAfter: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (player) {
      setAmount("");
      setReason("");
    }
  }, [player]);

  const submit = async () => {
    if (!player) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0) {
      toast.error("Enter a non-zero amount (use negative to deduct).");
      return;
    }
    setSaving(true);
    try {
      const { balanceAfter } = await adjustPlayerCoins({
        uid: player.uid,
        amount: value,
        reason: reason.trim() || undefined,
      });
      toast.success(`Balance updated to ${balanceAfter} coins.`);
      onDone(player.uid, balanceAfter);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Adjustment failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(player)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust coins</DialogTitle>
          <DialogDescription>
            {player?.displayName} — current balance {player?.arenaCoins ?? 0}.
            Use a negative amount to deduct.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500 or -200"
            />
          </div>
          <div>
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Compensation, correction, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
