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
import Link from "next/link";
import { createTournament, startTournamentBracket } from "@/lib/wallet/wallet-api";

export default function SuperAdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<
    (TournamentDocument & { id: string })[]
  >([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    visibility: "public" as "public" | "private",
    pin: "",
  });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(getFirebaseDb(), "tournaments"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(
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
        onSnapshot(collection(getFirebaseDb(), "tournaments"), (snap) => {
          setTournaments(
            snap.docs.map((d) => ({
              ...(d.data() as TournamentDocument),
              id: d.id,
            }))
          );
        });
      }
    );
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (form.visibility === "private" && !/^\d{4}$/.test(form.pin)) {
      toast.error("Private tournaments need a 4-digit PIN.");
      return;
    }
    setSaving(true);
    try {
      const result = await createTournament({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        visibility: form.visibility,
        pin: form.visibility === "private" ? form.pin : undefined,
      });
      toast.success(`Tournament created · code ${result.roomCode}`);
      setForm({ name: "", description: "", visibility: "public", pin: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async (id: string) => {
    if (!window.confirm("Start the bracket? Need 16 players; fees are deducted now.")) return;
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
          Host lobbies (same room flow as player page). Entry charged at start.
        </p>
      </div>

      <Card className="arena-card border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> New tournament
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="t-name">Name</Label>
            <Input
              id="t-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
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
          <div className="flex gap-2">
            <Button
              type="button"
              variant={form.visibility === "public" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setForm((f) => ({ ...f, visibility: "public" }))}
            >
              Public
            </Button>
            <Button
              type="button"
              variant={form.visibility === "private" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setForm((f) => ({ ...f, visibility: "private" }))}
            >
              Private
            </Button>
          </div>
          {form.visibility === "private" ? (
            <div>
              <Label htmlFor="t-pin">PIN</Label>
              <Input
                id="t-pin"
                inputMode="numeric"
                maxLength={4}
                value={form.pin}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pin: e.target.value.replace(/\D/g, "").slice(0, 4),
                  }))
                }
              />
            </div>
          ) : null}
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
                    {t.roomCode ? (
                      <Badge variant="outline" className="font-mono">
                        {t.roomCode}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.playerCount ?? 0}/{t.maxPlayers ?? 16} players ·{" "}
                    {t.registrationFeeCoins ?? 100} coins entry · reward{" "}
                    {t.championRewardCoins ?? 0}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/app/tournaments/${t.id}`}
                    className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent"
                  >
                    Open
                  </Link>
                  {t.status === "registration" ? (
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
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
