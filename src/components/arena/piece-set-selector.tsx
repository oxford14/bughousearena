"use client";

import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePieceSet } from "@/providers/piece-set-provider";
import type { PieceSetDefinition, PieceSetId } from "@/lib/game/piece-sets";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { toast } from "sonner";

function PieceSetSwatch({
  pieceSet,
  selected,
  locked,
  onSelect,
  size = "md",
}: {
  pieceSet: PieceSetDefinition;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  size?: "sm" | "md";
}) {
  const swatchSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${pieceSet.label} piece set${locked ? " (locked)" : ""}`}
      className={cn(
        "relative flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-2 transition-all cursor-pointer min-w-[88px]",
        size === "sm" && "min-w-[72px] px-2 py-1.5",
        selected
          ? "border-primary bg-primary/10 shadow-[0_0_16px_rgba(124,58,237,0.25)]"
          : locked
            ? "border-primary/15 opacity-75"
            : "border-primary/20 hover:border-primary/50"
      )}
    >
      {locked ? (
        <Lock
          className="absolute top-1 right-1 h-3 w-3 text-muted-foreground"
          aria-hidden
        />
      ) : null}
      <div className="flex items-center gap-1" aria-hidden>
        <span
          className={cn("rounded-full border border-white/20", swatchSize)}
          style={{ backgroundColor: pieceSet.whiteFill }}
        />
        <span
          className={cn("rounded-full border border-white/20", swatchSize)}
          style={{ backgroundColor: pieceSet.blackFill }}
        />
      </div>
      <span className={cn("font-medium", size === "sm" ? "text-[10px]" : "text-xs")}>
        {pieceSet.label}
      </span>
    </button>
  );
}

function PieceSetPicker({
  pieceSetId,
  pieceSets,
  isUnlocked,
  onSelect,
  onShopRequest,
  size = "md",
}: {
  pieceSetId: PieceSetId;
  pieceSets: PieceSetDefinition[];
  isUnlocked: (id: PieceSetId) => boolean;
  onSelect: (id: PieceSetId) => void;
  onShopRequest?: () => void;
  size?: "sm" | "md";
}) {
  const handleSelect = (id: PieceSetId) => {
    if (!isUnlocked(id)) {
      toast.message("Unlock this piece set in the Arena Shop.");
      onShopRequest?.();
      return;
    }
    onSelect(id);
  };

  return (
    <div className={cn("flex flex-wrap gap-3", size === "sm" && "gap-2")}>
      {pieceSets.map((pieceSet) => (
        <PieceSetSwatch
          key={pieceSet.id}
          pieceSet={pieceSet}
          selected={pieceSetId === pieceSet.id}
          locked={!isUnlocked(pieceSet.id)}
          onSelect={() => handleSelect(pieceSet.id)}
          size={size}
        />
      ))}
    </div>
  );
}

function PieceSetTriggerIcon({ pieceSet }: { pieceSet: PieceSetDefinition }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      <span
        className="h-2.5 w-2.5 rounded-full border border-white/20"
        style={{ backgroundColor: pieceSet.whiteFill }}
      />
      <span
        className="h-2.5 w-2.5 rounded-full border border-white/20"
        style={{ backgroundColor: pieceSet.blackFill }}
      />
    </div>
  );
}

export function PieceSetSelector({
  compact = false,
  onShopRequest,
}: {
  compact?: boolean;
  onShopRequest?: () => void;
}) {
  const { pieceSetId, pieceSet, pieceSets, setPieceSetId, isUnlocked } = usePieceSet();

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background text-sm shadow-xs hover:bg-accent hover:text-accent-foreground"
          aria-label="Change piece set"
        >
          <PieceSetTriggerIcon pieceSet={pieceSet} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Piece set</p>
          <PieceSetPicker
            pieceSetId={pieceSetId}
            pieceSets={pieceSets}
            isUnlocked={isUnlocked}
            onSelect={setPieceSetId}
            onShopRequest={onShopRequest}
            size="sm"
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">Piece set</Label>
        <p className="text-xs text-muted-foreground">
          Piece styling on your boards. Premium sets unlock in the shop.
        </p>
      </div>
      <PieceSetPicker
        pieceSetId={pieceSetId}
        pieceSets={pieceSets}
        isUnlocked={isUnlocked}
        onSelect={setPieceSetId}
        onShopRequest={onShopRequest}
      />
    </div>
  );
}
