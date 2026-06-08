"use client";

import { normalizeCaptured, type PieceSymbol } from "@/lib/game/bughouse-rules";
import { usePieceSet } from "@/providers/piece-set-provider";
import { reservePieceKeyFromColor } from "@/components/game/arena-pieces";
import { cn } from "@/lib/utils";
import { SparePiece } from "react-chessboard";

const RESERVE_ORDER: PieceSymbol[] = ["q", "r", "b", "n", "p"];

const PIECE_LABEL: Record<PieceSymbol, string> = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
  p: "Pawn",
};

interface PieceReserveProps {
  captured: string[];
  playerColor: import("@/types/firestore").PlayerColor;
  selectedPiece: PieceSymbol | null;
  interactive: boolean;
  /** When true, pieces are draggable onto the board (requires ChessboardProvider). */
  draggable?: boolean;
  label: string;
  onSelect?: (piece: PieceSymbol) => void;
}

export function PieceReserve({
  captured,
  playerColor,
  selectedPiece,
  interactive,
  draggable = false,
  label,
  onSelect,
}: PieceReserveProps) {
  const { pieces } = usePieceSet();
  const counts = normalizeCaptured(captured);
  const hasPieces = captured.length > 0;

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-[#12082a]/90 p-3 shadow-[inset_0_0_24px_rgba(124,58,237,0.12)]">
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
        {label}
      </p>
      {hasPieces ? (
        <div className="flex flex-wrap items-end justify-center gap-2">
          {RESERVE_ORDER.filter((piece) => counts[piece] > 0).map((piece) => {
            const key = reservePieceKeyFromColor(playerColor, piece);
            const PieceIcon = pieces[key];
            const isSelected = selectedPiece === piece;

            if (draggable && interactive) {
              return (
                <div
                  key={piece}
                  className={cn(
                    "relative flex h-14 w-14 flex-col items-center justify-center rounded-lg border transition-all cursor-grab active:cursor-grabbing",
                    isSelected
                      ? "border-[#4ade80] bg-[#4ade80]/15 shadow-[0_0_16px_rgba(74,222,128,0.35)]"
                      : "border-primary/25 bg-[#1a1035]/80 hover:border-primary/50 hover:bg-primary/10"
                  )}
                  title={`Drag ${PIECE_LABEL[piece]} onto the board`}
                  aria-label={`${PIECE_LABEL[piece]}${counts[piece] > 1 ? `, ${counts[piece]} available` : ""}`}
                >
                  <div className="h-10 w-10 pointer-events-auto">
                    <SparePiece pieceType={key} />
                  </div>
                  {counts[piece] > 1 ? (
                    <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {counts[piece]}
                    </span>
                  ) : null}
                </div>
              );
            }

            return (
              <button
                key={piece}
                type="button"
                disabled={!interactive}
                onClick={() => interactive && onSelect?.(piece)}
                className={cn(
                  "relative flex h-14 w-14 flex-col items-center justify-center rounded-lg border transition-all",
                  interactive ? "cursor-pointer" : "cursor-default opacity-90",
                  isSelected
                    ? "border-[#4ade80] bg-[#4ade80]/15 shadow-[0_0_16px_rgba(74,222,128,0.35)]"
                    : "border-primary/25 bg-[#1a1035]/80 hover:border-primary/50 hover:bg-primary/10"
                )}
                title={PIECE_LABEL[piece]}
                aria-label={`${PIECE_LABEL[piece]}${counts[piece] > 1 ? `, ${counts[piece]} available` : ""}`}
                aria-pressed={isSelected}
              >
                <div className="h-9 w-9 pointer-events-none">
                  <PieceIcon />
                </div>
                {counts[piece] > 1 ? (
                  <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {counts[piece]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground py-2">
          {interactive
            ? "Pieces your partner captures will appear here."
            : "No pieces in reserve yet."}
        </p>
      )}
    </div>
  );
}

/** Read-only compact row for the direct opponent's captured pieces. */
export function OpponentReserveStrip({
  captured,
  playerColor,
  opponentName,
}: {
  captured: string[];
  playerColor: import("@/types/firestore").PlayerColor;
  opponentName?: string;
}) {
  const { pieces } = usePieceSet();
  const counts = normalizeCaptured(captured);
  const available = RESERVE_ORDER.filter((piece) => counts[piece] > 0);
  const label = opponentName ? `${opponentName} reserve` : "Opp reserve";

  return (
    <div className="mb-1 flex min-h-[22px] items-center gap-2 px-1">
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {available.length === 0 ? (
        <span className="text-[10px] text-muted-foreground/70">—</span>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          {available.map((piece) => {
            const key = reservePieceKeyFromColor(playerColor, piece);
            const PieceIcon = pieces[key];
            return (
              <span
                key={piece}
                className="inline-flex items-center gap-0.5 rounded border border-primary/20 bg-[#1a1035]/60 px-1 py-0.5"
                title={`${PIECE_LABEL[piece]}${counts[piece] > 1 ? ` ×${counts[piece]}` : ""}`}
              >
                <span className="h-3.5 w-3.5 shrink-0 opacity-90 [&_svg]:h-full [&_svg]:w-full">
                  <PieceIcon />
                </span>
                {counts[piece] > 1 ? (
                  <span className="text-[9px] font-semibold tabular-nums text-muted-foreground">
                    {counts[piece]}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
