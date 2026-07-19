import { getFirebaseAuth } from "@/lib/firebase/config";
import type { AdminStats } from "@/app/api/admin/stats/route";
import type { AdminTransaction } from "@/app/api/admin/transactions/list/route";

async function getIdToken(): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Must be signed in.");
  return user.getIdToken();
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function getAdminStats() {
  return adminFetch<AdminStats>("/api/admin/stats");
}

export interface AdminPlayer {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  arenaCoins: number;
  rating: number;
  completedMatches: number;
  totalTopUpCentavos: number;
  banned: boolean;
  admin: boolean;
  superAdmin: boolean;
  createdAt: string | null;
}

export function listPlayers(query?: string) {
  const q = query ? `?q=${encodeURIComponent(query)}` : "";
  return adminFetch<{ players: AdminPlayer[] }>(`/api/admin/players/list${q}`);
}

export function adjustPlayerCoins(input: {
  uid: string;
  amount: number;
  reason?: string;
}) {
  return adminFetch<{ balanceAfter: number }>("/api/admin/players/adjust-coins", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function setPlayerBan(input: { uid: string; banned: boolean }) {
  return adminFetch<{ ok: boolean }>("/api/admin/players/ban", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function setPlayerRole(input: { uid: string; admin: boolean }) {
  return adminFetch<{ ok: boolean }>("/api/admin/players/role", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface AdminWithdrawal {
  id: string;
  uid: string;
  displayName: string;
  email: string | null;
  bundleId: string;
  coins: number;
  phpAmount: number;
  gcashNumber: string;
  gcashName: string;
  status: string;
  adminNote: string | null;
  paymongoTransferId: string | null;
  createdAt: string | null;
  processedAt: string | null;
}

export function listWithdrawals(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return adminFetch<{ withdrawals: AdminWithdrawal[] }>(
    `/api/admin/withdrawals/list${q}`
  );
}

export function payWithdrawal(requestId: string) {
  return adminFetch<{ status: string; transferId: string | null }>(
    "/api/admin/withdrawals/pay",
    { method: "POST", body: JSON.stringify({ requestId }) }
  );
}

export function resolveWithdrawal(input: {
  requestId: string;
  action: "paid" | "reject";
  adminNote?: string;
}) {
  return adminFetch<{ ok: boolean }>("/api/admin/withdrawals/resolve", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listTransactions(params?: { type?: string; uid?: string }) {
  const search = new URLSearchParams();
  if (params?.type) search.set("type", params.type);
  if (params?.uid) search.set("uid", params.uid);
  const q = search.toString();
  return adminFetch<{ transactions: AdminTransaction[] }>(
    `/api/admin/transactions/list${q ? `?${q}` : ""}`
  );
}
