"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarFrameWrapper } from "@/components/arena/avatar-frame";
import type { ShopCatalogItem } from "@/lib/shop/catalog";
import {
  BOARD_THEMES,
  isBoardThemeId,
  type BoardThemeDefinition,
} from "@/lib/game/board-themes";
import {
  PIECE_SETS,
  isPieceSetId,
  type PieceSetDefinition,
} from "@/lib/game/piece-sets";
import {
  MATCH_EMOTES,
  PREMIUM_QUICK_CHAT_TEMPLATES,
} from "@/lib/game/match-emotes";
import { cn } from "@/lib/utils";

function MiniBoardPreview({ theme }: { theme: BoardThemeDefinition }) {
  const squares = [
    theme.lightSquare,
    theme.darkSquare,
    theme.darkSquare,
    theme.lightSquare,
    theme.darkSquare,
    theme.lightSquare,
    theme.lightSquare,
    theme.darkSquare,
    theme.lightSquare,
    theme.darkSquare,
    theme.darkSquare,
    theme.lightSquare,
    theme.darkSquare,
    theme.lightSquare,
    theme.lightSquare,
    theme.darkSquare,
  ];

  return (
    <div
      className="relative mx-auto w-full max-w-[120px] rounded-md p-1"
      style={{
        boxShadow: theme.frameGlow,
        border: `1px solid ${theme.innerBorder}`,
      }}
    >
      <div className="grid grid-cols-4 grid-rows-4 overflow-hidden rounded-sm">
        {squares.map((color, i) => (
          <span key={i} className="aspect-square" style={{ backgroundColor: color }} />
        ))}
      </div>
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl drop-shadow-md"
        style={{ color: theme.notation }}
        aria-hidden
      >
        ♞
      </span>
    </div>
  );
}

function PieceSetPreview({ pieceSet }: { pieceSet: PieceSetDefinition }) {
  return (
    <div className="flex items-center justify-center gap-3 py-1">
      {(["♔", "♞", "♛"] as const).map((glyph, i) => (
        <span
          key={glyph}
          className="text-2xl font-heading leading-none"
          style={{
            color: i === 2 ? pieceSet.blackFill : pieceSet.whiteFill,
            filter: i === 2 ? pieceSet.blackFilter : pieceSet.whiteFilter,
          }}
          aria-hidden
        >
          {glyph}
        </span>
      ))}
    </div>
  );
}

function SocialPreview({ item }: { item: ShopCatalogItem }) {
  if (item.id === "social_team_comms") {
    return (
      <div className="flex w-full flex-col gap-1.5 px-1">
        {PREMIUM_QUICK_CHAT_TEMPLATES.slice(0, 3).map((line) => (
          <div
            key={line.id}
            className="rounded-lg rounded-bl-sm bg-primary/15 px-2 py-1 text-[10px] text-foreground/90 text-left"
          >
            {line.text}
          </div>
        ))}
      </div>
    );
  }

  const emotes = item.unlockIds
    .map((id) => MATCH_EMOTES.find((emote) => emote.id === id))
    .filter(Boolean);

  return (
    <div className="grid grid-cols-3 gap-1.5 px-2">
      {emotes.map((emote) => (
        <div
          key={emote!.id}
          className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/30 py-1.5"
          title={emote!.label}
        >
          <span className="text-xl leading-none">{emote!.glyph}</span>
          <span className="text-[9px] text-muted-foreground">{emote!.label}</span>
        </div>
      ))}
    </div>
  );
}

function ProfileFramePreview({ frameId }: { frameId: string }) {
  return (
    <div className="flex justify-center py-1">
      <AvatarFrameWrapper frameId={frameId}>
        <Avatar className="h-14 w-14 border-2 border-background">
          <AvatarFallback className="bg-primary/20 text-lg font-heading text-primary">
            BA
          </AvatarFallback>
        </Avatar>
      </AvatarFrameWrapper>
    </div>
  );
}

export function ShopItemPreview({
  item,
  className,
}: {
  item: ShopCatalogItem;
  className?: string;
}) {
  const unlockId = item.unlockIds[0];

  let content: React.ReactNode = null;

  if (item.category === "board" && unlockId && isBoardThemeId(unlockId)) {
    content = <MiniBoardPreview theme={BOARD_THEMES[unlockId]} />;
  } else if (item.category === "piece" && unlockId && isPieceSetId(unlockId)) {
    content = <PieceSetPreview pieceSet={PIECE_SETS[unlockId]} />;
  } else if (item.category === "social") {
    content = <SocialPreview item={item} />;
  } else if (item.category === "profile" && unlockId) {
    content = <ProfileFramePreview frameId={unlockId} />;
  }

  return (
    <div
      className={cn(
        "shop-item-preview flex min-h-[88px] w-full items-center justify-center rounded-lg border border-border/40 bg-muted/15 p-2",
        className
      )}
    >
      {content}
    </div>
  );
}
