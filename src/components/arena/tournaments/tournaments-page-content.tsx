"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Plus, Search, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type { TournamentDocument } from "@/types/wallet";
import { useAuth } from "@/providers/auth-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  createTournament,
  TOURNAMENT_ENTRY_FEE,
  TOURNAMENT_MAX_PLAYERS,
} from "@/lib/wallet/tournament-client";
import { toast } from "sonner";

type CreateForm = {
  name: string;
  description: string;
  visibility: "public" | "private";
  pin: string;
};

const emptyForm: CreateForm = {
  name: "",
  description: "",
  visibility: "public",
  pin: "",
};

function CreateTournamentForm({
  form,
  setForm,
  creating,
  onSubmit,
}: {
  form: CreateForm;
  setForm: (next: CreateForm) => void;
  creating: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3">
      <Input
        placeholder="Tournament name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        autoFocus
      />
      <Input
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant={form.visibility === "public" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setForm({ ...form, visibility: "public" })}
        >
          Public
        </Button>
        <Button
          type="button"
          variant={form.visibility === "private" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setForm({ ...form, visibility: "private" })}
        >
          Private
        </Button>
      </div>
      {form.visibility === "private" ? (
        <Input
          inputMode="numeric"
          maxLength={4}
          placeholder="4-digit PIN"
          value={form.pin}
          onChange={(e) =>
            setForm({
              ...form,
              pin: e.target.value.replace(/\D/g, "").slice(0, 4),
            })
          }
        />
      ) : null}
      <p className="text-xs text-muted-foreground">
        You enter as host in slot 1. Entry ({TOURNAMENT_ENTRY_FEE} coins each)
        is charged when the tournament starts.
      </p>
      <Button
        className="btn-arena-primary w-full"
        disabled={creating}
        onClick={onSubmit}
      >
        {creating ? "Creating…" : "Create room"}
      </Button>
    </div>
  );
}

export default function TournamentsPageContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [tournaments, setTournaments] = useState<
    (TournamentDocument & { id: string })[]
  >([]);
  const [codeSearch, setCodeSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyForm);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    const q = query(
      collection(getFirebaseDb(), "tournaments"),
      orderBy("createdAt", "desc")
    );
    unsub = onSnapshot(
      q,
      (snap) => {
        setTournaments(
          snap.docs.map((d) => ({
            ...(d.data() as TournamentDocument),
            id: d.id,
          }))
        );
      },
      () => {
        unsub = onSnapshot(
          collection(getFirebaseDb(), "tournaments"),
          (snap) => {
            const list = snap.docs.map((d) => ({
              ...(d.data() as TournamentDocument),
              id: d.id,
            }));
            list.sort((a, b) => {
              const at =
                a.createdAt?.toMillis?.() ?? a.startsAt?.toMillis?.() ?? 0;
              const bt =
                b.createdAt?.toMillis?.() ?? b.startsAt?.toMillis?.() ?? 0;
              return bt - at;
            });
            setTournaments(list);
          }
        );
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const open = tournaments.filter((t) => t.status !== "cancelled");
    const q = codeSearch.trim().toUpperCase();
    if (!q) return open;
    return open.filter((t) => (t.roomCode ?? "").toUpperCase().includes(q));
  }, [tournaments, codeSearch]);

  const openCreate = () => {
    if (!user) {
      toast.error("Sign in to host a tournament.");
      return;
    }
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!user || !profile) {
      toast.error("Sign in to host a tournament.");
      return;
    }
    if (!createForm.name.trim()) {
      toast.error("Enter a tournament name.");
      return;
    }
    if (
      createForm.visibility === "private" &&
      !/^\d{4}$/.test(createForm.pin)
    ) {
      toast.error("Private rooms need a 4-digit PIN.");
      return;
    }
    setCreating(true);
    try {
      const result = await createTournament({
        name: createForm.name,
        description: createForm.description,
        visibility: createForm.visibility,
        pin: createForm.visibility === "private" ? createForm.pin : undefined,
        hostDisplayName: profile.displayName,
      });
      toast.success(`Room created · code ${result.roomCode}`);
      setCreateForm(emptyForm);
      setCreateOpen(false);
      router.push(`/app/tournaments/${result.tournamentId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Create failed.");
    } finally {
      setCreating(false);
    }
  };

  const formProps = {
    form: createForm,
    setForm: setCreateForm,
    creating,
    onSubmit: () => void handleCreate(),
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-3xl neon-glow flex items-center gap-2">
          <Trophy className="h-8 w-8" />
          Tournaments
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse rooms and enter one to pick a slot. Hosts start when all{" "}
          {TOURNAMENT_MAX_PLAYERS} seats are filled — {TOURNAMENT_ENTRY_FEE}{" "}
          coins are deducted then. Champions split 80% of the pool.
        </p>
      </motion.div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by room code"
            value={codeSearch}
            onChange={(e) => setCodeSearch(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="btn-arena-primary shrink-0 gap-1.5 px-3"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="arena-card border-primary/20 p-6 text-center text-muted-foreground">
          No open rooms. Create a tournament to get started.
        </Card>
      ) : (
        filtered.map((t) => {
          const maxPlayers = t.maxPlayers ?? TOURNAMENT_MAX_PLAYERS;
          const playerCount = t.playerCount ?? t.memberUids?.length ?? 0;
          const youIn =
            user?.uid &&
            (t.memberUids?.includes(user.uid) ||
              t.slots?.includes(user.uid));

          return (
            <Card key={t.id} className="arena-card border-primary/20">
              <CardHeader>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <CardTitle className="font-heading flex items-center gap-2 flex-wrap">
                      {t.name}
                      {t.visibility === "private" ? (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" /> Private
                        </Badge>
                      ) : (
                        <Badge variant="outline">Public</Badge>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      {t.status === "registration" ? "Lobby" : t.status} · Code{" "}
                      <span className="font-mono text-foreground">
                        {t.roomCode ?? "—"}
                      </span>
                      {t.hostDisplayName
                        ? ` · Host ${t.hostDisplayName}`
                        : null}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground uppercase">
                      Players
                    </p>
                    <p className="font-heading text-lg text-primary flex items-center justify-end gap-1">
                      <Users className="h-4 w-4" />
                      {playerCount}/{maxPlayers}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase">
                      Champion reward
                    </p>
                    <p className="text-sm text-primary">
                      {(t.championRewardCoins ?? 0).toLocaleString()} coins
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {t.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {t.description}
                  </p>
                ) : null}
                <p className="text-sm">
                  Entry:{" "}
                  <span className="text-primary font-medium">
                    {t.registrationFeeCoins ?? TOURNAMENT_ENTRY_FEE} coins
                  </span>{" "}
                  (charged at start)
                </p>
                <Button
                  className="btn-arena-primary w-full"
                  onClick={() => router.push(`/app/tournaments/${t.id}`)}
                >
                  {youIn
                    ? "Enter room"
                    : t.status === "registration"
                      ? "Enter room"
                      : "View room"}
                </Button>
              </CardContent>
            </Card>
          );
        })
      )}

      {isMobile ? (
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl pb-8">
            <SheetHeader className="px-0 pt-0">
              <SheetTitle>Create tournament</SheetTitle>
              <SheetDescription>
                Host a room. You take slot 1 automatically.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4">
              <CreateTournamentForm {...formProps} />
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md border-primary/30">
            <DialogHeader>
              <DialogTitle>Create tournament</DialogTitle>
              <DialogDescription>
                Host a room. You take slot 1 automatically.
              </DialogDescription>
            </DialogHeader>
            <CreateTournamentForm {...formProps} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
