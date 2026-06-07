"use client";

import { Palette } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBoardTheme } from "@/providers/board-theme-provider";
import type { BoardThemeDefinition, BoardThemeId } from "@/lib/game/board-themes";
import { cn } from "@/lib/utils";

function ThemeSwatch({
  theme,
  selected,
  onSelect,
  size = "md",
}: {
  theme: BoardThemeDefinition;
  selected: boolean;
  onSelect: () => void;
  size?: "sm" | "md";
}) {
  const swatchSize = size === "sm" ? "h-8 w-8" : "h-12 w-12";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${theme.label} board theme`}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border-2 p-1.5 transition-all cursor-pointer",
        selected
          ? "border-primary bg-primary/10 shadow-[0_0_16px_rgba(124,58,237,0.25)]"
          : "border-primary/20 bg-muted/20 hover:border-primary/50"
      )}
    >
      <div
        className={cn("grid grid-cols-2 grid-rows-2 overflow-hidden rounded", swatchSize)}
        aria-hidden
      >
        <span style={{ backgroundColor: theme.lightSquare }} />
        <span style={{ backgroundColor: theme.darkSquare }} />
        <span style={{ backgroundColor: theme.darkSquare }} />
        <span style={{ backgroundColor: theme.lightSquare }} />
      </div>
      <span className={cn("font-medium", size === "sm" ? "text-[10px]" : "text-xs")}>
        {theme.label}
      </span>
    </button>
  );
}

function ThemePicker({
  themeId,
  themes,
  onSelect,
  size = "md",
}: {
  themeId: BoardThemeId;
  themes: BoardThemeDefinition[];
  onSelect: (id: BoardThemeId) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("flex flex-wrap gap-3", size === "sm" && "gap-2")}>
      {themes.map((theme) => (
        <ThemeSwatch
          key={theme.id}
          theme={theme}
          selected={themeId === theme.id}
          onSelect={() => onSelect(theme.id)}
          size={size}
        />
      ))}
    </div>
  );
}

export function BoardThemeSelector({ compact = false }: { compact?: boolean }) {
  const { themeId, themes, setThemeId } = useBoardTheme();

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background text-sm shadow-xs hover:bg-accent hover:text-accent-foreground"
          aria-label="Change board theme"
        >
          <Palette className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Board theme</p>
          <ThemePicker themeId={themeId} themes={themes} onSelect={setThemeId} size="sm" />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">Board theme</Label>
        <p className="text-xs text-muted-foreground">
          Square colors for in-game boards — saved on this device
        </p>
      </div>
      <ThemePicker themeId={themeId} themes={themes} onSelect={setThemeId} />
    </div>
  );
}
