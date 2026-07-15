import { getFirebaseAuth } from "@/lib/firebase/config";

async function getIdToken(): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Must be signed in.");
  return user.getIdToken();
}

async function walletFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Request failed.");
  }
  return data;
}

export function claimDailyBonus() {
  return walletFetch<{
    claimed: boolean;
    coins: number;
    streak: number;
    balanceAfter: number;
  }>("/api/rewards/daily-claim", { method: "POST" });
}

export function applyReferralCode(code: string) {
  return walletFetch<{ applied: boolean; referrerUid?: string }>(
    "/api/referrals/apply",
    { method: "POST", body: JSON.stringify({ code }) }
  );
}

export function getMyReferralCode() {
  return walletFetch<{ code: string; referralCount: number; coinsEarned: number }>(
    "/api/referrals/my-code"
  );
}

export function joinStakeQueue(stakeAmount: number, queueEntryId: string) {
  return walletFetch<{ balanceAfter: number }>("/api/stake/join", {
    method: "POST",
    body: JSON.stringify({ stakeAmount, queueEntryId }),
  });
}

export function leaveStakeQueue() {
  return walletFetch<{ refunded: boolean }>("/api/stake/leave", {
    method: "POST",
  });
}

export function requestRedemption(input: {
  bundleId: string;
  gcashNumber: string;
  gcashName: string;
}) {
  return walletFetch<{ requestId: string; balanceAfter: number }>(
    "/api/redeem/request",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function checkRedeemEligibility() {
  return walletFetch<{ eligible: boolean; reasons: string[] }>(
    "/api/redeem/eligibility"
  );
}

export function registerTournamentTeam(input: {
  tournamentId: string;
  partnerUid: string;
  teamName?: string;
}) {
  return walletFetch<{ teamId: string }>("/api/tournaments/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createTournament(input: {
  name: string;
  description?: string;
  registrationFeeCoins: number;
  startsAt: string;
}) {
  return walletFetch<{ tournamentId: string }>("/api/tournaments/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function startTournamentBracket(tournamentId: string) {
  return walletFetch<{ started: boolean }>("/api/tournaments/start-bracket", {
    method: "POST",
    body: JSON.stringify({ tournamentId }),
  });
}

export function advanceTournamentMatch(matchId: string) {
  return walletFetch<{ advanced: boolean }>("/api/tournaments/advance-match", {
    method: "POST",
    body: JSON.stringify({ matchId }),
  });
}

export function processRedemption(
  requestId: string,
  action: "paid" | "reject",
  adminNote?: string
) {
  return walletFetch<{ ok: boolean }>("/api/redeem/admin/process", {
    method: "POST",
    body: JSON.stringify({ requestId, action, adminNote }),
  });
}

export function listPendingRedemptions() {
  return walletFetch<{
    requests: Array<{
      id: string;
      uid: string;
      bundleId: string;
      coins: number;
      phpAmount: number;
      gcashNumber: string;
      gcashName: string;
      status: string;
      createdAt: string | null;
    }>;
  }>("/api/redeem/admin/list");
}
