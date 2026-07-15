import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { CoinLedgerType } from "@/types/wallet";

export type WalletMutationInput = {
  uid: string;
  amount: number;
  type: CoinLedgerType;
  refId: string;
  metadata?: Record<string, unknown>;
};

export class WalletError extends Error {
  constructor(
    message: string,
    public readonly code: "INSUFFICIENT_FUNDS" | "NOT_FOUND" | "ALREADY_PROCESSED"
  ) {
    super(message);
    this.name = "WalletError";
  }
}

function ledgerDocId(type: CoinLedgerType, refId: string, uid: string): string {
  return `${type}_${refId}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function creditCoins(
  db: Firestore,
  input: WalletMutationInput
): Promise<{ credited: boolean; balanceAfter: number }> {
  if (input.amount <= 0) {
    throw new Error("Credit amount must be positive.");
  }
  return mutateCoins(db, input);
}

export async function debitCoins(
  db: Firestore,
  input: WalletMutationInput
): Promise<{ debited: boolean; balanceAfter: number }> {
  if (input.amount >= 0) {
    throw new Error("Debit amount must be negative.");
  }
  const result = await mutateCoins(db, input);
  return { debited: result.credited, balanceAfter: result.balanceAfter };
}

async function mutateCoins(
  db: Firestore,
  input: WalletMutationInput
): Promise<{ credited: boolean; balanceAfter: number }> {
  const ledgerId = ledgerDocId(input.type, input.refId, input.uid);
  const userRef = db.collection("users").doc(input.uid);
  const ledgerRef = db.collection("coinLedger").doc(ledgerId);

  return db.runTransaction(async (tx) => {
    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists) {
      const existing = ledgerSnap.data()!;
      return {
        credited: false,
        balanceAfter: (existing.balanceAfter as number) ?? 0,
      };
    }

    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new WalletError("User not found.", "NOT_FOUND");
    }

    const currentBalance = (userSnap.data()?.arenaCoins as number) ?? 0;
    const nextBalance = currentBalance + input.amount;

    if (nextBalance < 0) {
      throw new WalletError("Not enough Arena Coins.", "INSUFFICIENT_FUNDS");
    }

    tx.update(userRef, { arenaCoins: nextBalance });
    tx.set(ledgerRef, {
      uid: input.uid,
      amount: input.amount,
      type: input.type,
      refId: input.refId,
      balanceAfter: nextBalance,
      metadata: input.metadata ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { credited: true, balanceAfter: nextBalance };
  });
}

export function creditCoinsInTransaction(
  tx: Transaction,
  db: Firestore,
  input: WalletMutationInput,
  preloadedBalance?: number
): number {
  const ledgerId = ledgerDocId(input.type, input.refId, input.uid);
  const userRef = db.collection("users").doc(input.uid);
  const ledgerRef = db.collection("coinLedger").doc(ledgerId);

  if (input.amount <= 0) {
    throw new Error("Credit amount must be positive.");
  }

  const currentBalance = preloadedBalance ?? 0;
  const nextBalance = currentBalance + input.amount;

  tx.update(userRef, { arenaCoins: nextBalance });
  tx.set(ledgerRef, {
    uid: input.uid,
    amount: input.amount,
    type: input.type,
    refId: input.refId,
    balanceAfter: nextBalance,
    metadata: input.metadata ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return nextBalance;
}

export function debitCoinsInTransaction(
  tx: Transaction,
  db: Firestore,
  input: WalletMutationInput,
  preloadedBalance: number
): number {
  const ledgerId = ledgerDocId(input.type, input.refId, input.uid);
  const userRef = db.collection("users").doc(input.uid);
  const ledgerRef = db.collection("coinLedger").doc(ledgerId);

  if (input.amount >= 0) {
    throw new Error("Debit amount must be negative.");
  }

  const nextBalance = preloadedBalance + input.amount;
  if (nextBalance < 0) {
    throw new WalletError("Not enough Arena Coins.", "INSUFFICIENT_FUNDS");
  }

  tx.update(userRef, { arenaCoins: nextBalance });
  tx.set(ledgerRef, {
    uid: input.uid,
    amount: input.amount,
    type: input.type,
    refId: input.refId,
    balanceAfter: nextBalance,
    metadata: input.metadata ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return nextBalance;
}

export async function getUserBalance(
  db: Firestore,
  uid: string
): Promise<number> {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return 0;
  return (snap.data()?.arenaCoins as number) ?? 0;
}
