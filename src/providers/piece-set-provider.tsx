"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_PIECE_SET_ID,
  PIECE_SET_LIST,
  type PieceSetDefinition,
  type PieceSetId,
  isPieceSetId,
} from "@/lib/game/piece-sets";
import { getPiecesForSet, type ArenaPieces } from "@/components/game/arena-pieces";
import { useAuth } from "@/providers/auth-provider";
import { isPieceSetUnlocked } from "@/lib/shop/inventory";
import { equipShopItem } from "@/lib/shop/shop-api";

interface PieceSetContextValue {
  pieceSetId: PieceSetId;
  pieceSet: PieceSetDefinition;
  pieceSets: PieceSetDefinition[];
  pieces: ArenaPieces;
  setPieceSetId: (id: PieceSetId) => void;
  isUnlocked: (id: PieceSetId) => boolean;
}

const PieceSetContext = createContext<PieceSetContextValue | null>(null);

export function PieceSetProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [pieceSetId, setPieceSetIdState] = useState<PieceSetId>(DEFAULT_PIECE_SET_ID);

  useEffect(() => {
    const equipped = profile?.equippedPieceSet;
    if (equipped && isPieceSetId(equipped) && isPieceSetUnlocked(profile, equipped)) {
      setPieceSetIdState(equipped);
    }
  }, [profile?.equippedPieceSet, profile?.ownedItems]);

  const setPieceSetId = useCallback(
    (id: PieceSetId) => {
      if (!isPieceSetUnlocked(profile, id)) return;
      setPieceSetIdState(id);
      void equipShopItem("pieceSet", id).catch(() => {});
    },
    [profile]
  );

  const value = useMemo<PieceSetContextValue>(() => {
    const pieceSet = PIECE_SET_LIST.find((entry) => entry.id === pieceSetId) ?? PIECE_SET_LIST[0]!;
    return {
      pieceSetId,
      pieceSet,
      pieceSets: PIECE_SET_LIST,
      pieces: getPiecesForSet(pieceSetId),
      setPieceSetId,
      isUnlocked: (id) => isPieceSetUnlocked(profile, id),
    };
  }, [pieceSetId, profile, setPieceSetId]);

  return (
    <PieceSetContext.Provider value={value}>{children}</PieceSetContext.Provider>
  );
}

export function usePieceSet() {
  const ctx = useContext(PieceSetContext);
  if (!ctx) {
    throw new Error("usePieceSet must be used within PieceSetProvider");
  }
  return ctx;
}
