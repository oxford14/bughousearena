"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { arenaPieces } from "@/components/game/arena-pieces";
import {
  PROMOTION_CHOICES,
  type PendingPromotion,
} from "@/lib/game/promotion";
import type { PieceSymbol } from "@/lib/game/bughouse-engine";
import { cn } from "@/lib/utils";

interface PromotionPickerDialogProps {
  pending: PendingPromotion | null;
  onSelect: (piece: PieceSymbol) => void;
  onCancel: () => void;
}

export function PromotionPickerDialog({
  pending,
  onSelect,
  onCancel,
}: PromotionPickerDialogProps) {
  const color = pending?.seatColor ?? "w";

  return (
    <Dialog
      open={Boolean(pending)}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-sm border-primary/30 bg-[#12082a]/95 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Promote pawn</DialogTitle>
          <DialogDescription>
            Choose the piece your pawn becomes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PROMOTION_CHOICES.map(({ piece, label }) => {
            const key = `${color}${piece.toUpperCase()}` as keyof typeof arenaPieces;
            const Piece = arenaPieces[key] ?? arenaPieces.wQ;
            return (
              <button
                key={piece}
                type="button"
                onClick={() => onSelect(piece)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 border-primary/30 bg-card/50 px-3 py-4 transition-all cursor-pointer",
                  "hover:border-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <div className="h-14 w-14 pointer-events-none sm:h-16 sm:w-16">
                  <Piece />
                </div>
                <span className="font-heading text-sm">{label}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
