"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Play, Trophy } from "lucide-react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getFirebaseDb } from "@/lib/firebase/config";
import type { TournamentDocument } from "@/types/wallet";
import { createTournament, startTournamentBracket } from "@/lib/wallet/wallet-api";

export default function SuperAdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<
    (TournamentDocument & { id: string })[]
  >([]);
  const [form, setForm] = useState({ name: "", description: "", fee: 100, startsAt: "" });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const handleCreate = async () => {
    if (!form.name.trim() || !form.startsAt) {
      toast.error("Name and start time are required.");
      return;
    }
    setSaving(true);
    try {
      await createTournament({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        registrationFeeCoins: Number(form.fee),
        startsAt: new Date(form.startsAt).toISOString(),
      });
      toast.success("Tournament created.");
      setForm({ name: "", description: "", fee: 100, startsAt: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async (id: string) => {
    if (!window.confirm("Start the bracket? Registration will close.")) return;
    setBusyId(id);
    try {
      await startTournamentBracket(id);
      toast.success("Bracket started.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Start failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-3xl neon-glow">Tournaments</h1>
        <p className="text-sm text-muted-foreground">
          Create tournaments and start their brackets.
        </p>
      </div>

      <Card className="arena-card border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> New tournament
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="t-name">Name</Label>
              <Input
                id="t-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="t-fee">Registration fee (coins)</Label>
              <Input
                id="t-fee"
                type="number"
                value={form.fee}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fee: Number(e.target.value) }))
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="t-desc">Description (optional)</Label>
            <Input
              id="t-desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="t-start">Starts at</Label>
            <Input
              id="t-start"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, startsAt: e.target.value }))
              }
            />
          </div>
          <Button onClick={() => void handleCreate()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {tournaments.length === 0 ? (
          <Card className="arena-card p-6 text-center text-muted-foreground">
            No tournaments yet.
          </Card>
        ) : (
          tournaments.map((t) => (
            <Card key={t.id} className="arena-card border-primary/20">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-medium text-foreground">
                    <Trophy className="h-4 w-4 shrink-0 text-primary" />
                    {t.name}
                    <Badge variant="secondary">{t.status}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.registeredTeamCount ?? 0} teams · {t.registrationFeeCoins}{" "}
                    coins entry · reward {t.championRewardCoins ?? 0}
                  </p>
                </div>
                {t.status === "registration" && (
                  <Button
                    size="sm"
                    disabled={busyId === t.id}
                    onClick={() => void handleStart(t.id)}
                  >
                    {busyId === t.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Start
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
