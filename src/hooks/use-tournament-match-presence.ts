"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchDocument } from "@/types/firestore";
import {
  checkTournamentForfeit,
  tournamentMatchHeartbeat,
} from "@/lib/wallet/wallet-api";
import { TOURNAMENT_DISCONNECT_FORFEIT_MS } from "@/lib/wallet/tournament-constants";

const HEARTBEAT_MS = 5_000;
const STALE_WARN_MS = 5_000;

/**
 * Tournament match presence: heartbeat + forfeit polling.
 * Survives accidental reloads as long as reconnect is under 30s.
 */
export function useTournamentMatchPresence(
  match: MatchDocument | null,
  humanUid: string | undefined
) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!match?.tournamentId || !humanUid) return;
    if (match.status === "completed" || match.status === "abandoned") return;

    const beat = () => {
      void tournamentMatchHeartbeat(match.id).catch(() => {});
    };
    beat();
    const hb = window.setInterval(beat, HEARTBEAT_MS);

    const check = () => {
      void checkTournamentForfeit(match.id).catch(() => {});
    };
    const ck = window.setInterval(check, HEARTBEAT_MS);

    const clock = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      window.clearInterval(hb);
      window.clearInterval(ck);
      window.clearInterval(clock);
    };
  }, [match?.id, match?.tournamentId, match?.status, humanUid]);

  const countdown = useMemo(() => {
    if (!match?.tournamentHeartbeats || !match.playerUids) return null;
    const hearts = match.tournamentHeartbeats;
    let worstUid: string | null = null;
    let worstAge = 0;
    for (const uid of match.playerUids) {
      const age = now - (hearts[uid] ?? 0);
      if (age > worstAge) {
        worstAge = age;
        worstUid = uid;
      }
    }
    if (!worstUid || worstAge < STALE_WARN_MS) return null;
    const remaining = Math.max(
      0,
      Math.ceil((TOURNAMENT_DISCONNECT_FORFEIT_MS - worstAge) / 1000)
    );
    return { uid: worstUid, remainingSec: remaining, ageMs: worstAge };
  }, [match?.tournamentHeartbeats, match?.playerUids, now]);

  return { disconnectCountdown: countdown };
}
