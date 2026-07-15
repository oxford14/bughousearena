"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type { TournamentDocument, TournamentTeam } from "@/types/wallet";
import { useAuth } from "@/providers/auth-provider";
import { registerTournamentTeam, createTournament, startTournamentBracket } from "@/lib/wallet/wallet-api";
import { isUserAdmin } from "@/lib/wallet/admin-client";
import { toast } from "sonner";

export default function TournamentsPageContent() {
  const { user, profile } = useAuth();
  const [tournaments, setTournaments] = useState<(TournamentDocument & { id: string })[]>([]);
  const [teams, setTeams] = useState<Record<string, (TournamentTeam & { id: string })[]>>({});
  const [partnerUid, setPartnerUid] = useState("");
  const [teamName, setTeamName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({
    name: "",
    description: "",
    fee: 100,
    startsAt: "",
  });

  useEffect(() => {
    const q = query(
      collection(getFirebaseDb(), "tournaments"),
      orderBy("startsAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setTournaments(
        snap.docs.map((d) => ({ ...(d.data() as TournamentDocument), id: d.id }))
      );
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    void isUserAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
  }, [user]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    for (const t of tournaments) {
      const unsub = onSnapshot(
        collection(getFirebaseDb(), "tournaments", t.id, "teams"),
        (snap) => {
          setTeams((prev) => ({
            ...prev,
            [t.id]: snap.docs.map((d) => ({
              ...(d.data() as TournamentTeam),
              id: d.id,
            })),
          }));
        }
      );
      unsubs.push(unsub);
    }
    return () => unsubs.forEach((u) => u());
  }, [tournaments]);

  const handleRegister = async (tournamentId: string) => {
    try {
      await registerTournamentTeam({
        tournamentId,
        partnerUid,
        teamName,
      });
      toast.success("Team registered! Champion Reward pool updated.");
      setPartnerUid("");
      setTeamName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed.");
    }
  };

  const handleCreate = async () => {
    try {
      await createTournament({
        name: adminForm.name,
        description: adminForm.description,
        registrationFeeCoins: adminForm.fee,
        startsAt: adminForm.startsAt,
      });
      toast.success("Tournament created!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Create failed.");
    }
  };

  const handleStart = async (tournamentId: string) => {
    try {
      await startTournamentBracket(tournamentId);
      toast.success("Bracket started!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Start failed.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-3xl neon-glow flex items-center gap-2">
          <Trophy className="h-8 w-8" />
          Tournaments
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Register with a partner, compete in brackets, and claim the Champion Reward.
        </p>
      </motion.div>

      {isAdmin ? (
        <Card className="arena-card border-accent/30">
          <CardHeader>
            <CardTitle className="text-base">Admin — Create event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Tournament name"
              value={adminForm.name}
              onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
            />
            <Input
              placeholder="Description"
              value={adminForm.description}
              onChange={(e) => setAdminForm({ ...adminForm, description: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Registration fee (coins)"
              value={adminForm.fee}
              onChange={(e) =>
                setAdminForm({ ...adminForm, fee: Number(e.target.value) })
              }
            />
            <Input
              type="datetime-local"
              value={adminForm.startsAt}
              onChange={(e) =>
                setAdminForm({ ...adminForm, startsAt: e.target.value })
              }
            />
            <Button className="btn-arena-primary" onClick={handleCreate}>
              Create tournament
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tournaments.length === 0 ? (
        <Card className="arena-card border-primary/20 p-6 text-center text-muted-foreground">
          No tournaments yet. Check back soon!
        </Card>
      ) : (
        tournaments.map((t) => (
          <Card key={t.id} className="arena-card border-primary/20">
            <CardHeader>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <CardTitle className="font-heading">{t.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">{t.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase">Champion Reward</p>
                  <p className="font-heading text-lg text-primary">
                    {t.championRewardCoins.toLocaleString()} coins
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {t.description ? (
                <p className="text-sm text-muted-foreground">{t.description}</p>
              ) : null}
              <p className="text-sm">
                Entry: <span className="text-primary font-medium">{t.registrationFeeCoins} coins</span>{" "}
                per player · {t.registeredTeamCount}/{t.maxTeams} teams
              </p>

              {(teams[t.id] ?? []).length > 0 ? (
                <div className="rounded-lg border border-primary/15 p-3 space-y-1">
                  <p className="text-xs uppercase text-muted-foreground mb-2">Registered teams</p>
                  {(teams[t.id] ?? []).map((team) => (
                    <p key={team.id} className="text-sm">
                      {team.teamName} — {team.player1DisplayName} & {team.player2DisplayName}
                    </p>
                  ))}
                </div>
              ) : null}

              {t.bracket && t.bracket.length > 0 ? (
                <div className="rounded-lg border border-primary/15 p-3">
                  <p className="text-xs uppercase text-muted-foreground mb-2">Bracket</p>
                  {t.bracket.map((m) => (
                    <p key={m.id} className="text-xs text-muted-foreground">
                      R{m.round}: {m.team1Id ? "Team" : "TBD"} vs {m.team2Id ? "Team" : "TBD"}
                      {m.winnerTeamId ? " ✓" : m.matchId ? " (live)" : ""}
                    </p>
                  ))}
                </div>
              ) : null}

              {t.status === "registration" ? (
                <div className="space-y-2 border-t border-primary/10 pt-4">
                  <p className="text-xs uppercase text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Register with a partner
                  </p>
                  <Input
                    placeholder="Partner UID (from their profile URL)"
                    value={partnerUid}
                    onChange={(e) => setPartnerUid(e.target.value)}
                  />
                  <Input
                    placeholder="Team name (optional)"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                  <Button
                    className="btn-arena-primary w-full"
                    disabled={!partnerUid.trim()}
                    onClick={() => handleRegister(t.id)}
                  >
                    Register — {t.registrationFeeCoins} coins each
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    Tip: find friends in{" "}
                    <Link href="/app/friends" className="text-primary underline">
                      Friends
                    </Link>{" "}
                    and copy their UID from profile.
                  </p>
                </div>
              ) : null}

              {isAdmin && t.status === "registration" ? (
                <Button variant="outline" onClick={() => handleStart(t.id)}>
                  Start bracket (admin)
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
