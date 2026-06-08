import { getFirebaseAuth } from "@/lib/firebase/config";
import type { PieceSymbol } from "@/lib/game/bughouse-engine";

export async function submitBotMoveViaApi(
  matchId: string,
  boardId: string,
  playerId: string,
  move: string,
  promotion?: PieceSymbol
): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error("Must be signed in.");
  }

  const token = await user.getIdToken();
  const response = await fetch("/api/match/bot-move", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ matchId, boardId, playerId, move, promotion }),
  });

  const data = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Bot move failed.");
  }
}
