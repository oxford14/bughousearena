"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { MatchMode } from "@/components/arena/lobby/match-mode-panel";

const CAROUSEL_MODES: {
  id: MatchMode;
  label: string;
  icon: string;
  blurb: string;
}[] = [
  {
    id: "casual",
    label: "Casual",
    icon: "/assets/lobby/mode-casual.svg",
    blurb: "Unranked team bughouse",
  },
  {
    id: "ranked",
    label: "Ranked",
    icon: "/assets/lobby/mode-ranked.svg",
    blurb: "Climb the Bughouse ladder",
  },
  {
    id: "stake",
    label: "Stake",
    icon: "/assets/lobby/mode-ranked.svg",
    blurb: "Coin stakes · party OK",
  },
  {
    id: "private",
    label: "Private",
    icon: "/assets/lobby/mode-private.svg",
    blurb: "Invite with a room code",
  },
];

interface MatchModeCarouselProps {
  activeMode: MatchMode;
  onModeChange: (mode: MatchMode) => void;
  disabled?: boolean;
}

function cardButtons(el: HTMLDivElement): HTMLElement[] {
  return [...el.children].filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && node.tagName === "BUTTON"
  );
}

/** ScrollLeft needed so `child` sits at the start of the scroller. */
function scrollLeftForCard(scroller: HTMLDivElement, child: HTMLElement): number {
  if (child === cardButtons(scroller)[0]) return 0;
  const scrollerRect = scroller.getBoundingClientRect();
  const childRect = child.getBoundingClientRect();
  return Math.max(
    0,
    scroller.scrollLeft + (childRect.left - scrollerRect.left)
  );
}

export function MatchModeCarousel({
  activeMode,
  onModeChange,
  disabled,
}: MatchModeCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      CAROUSEL_MODES.findIndex((m) => m.id === activeMode)
    )
  );
  const indexRef = useRef(index);
  indexRef.current = index;
  /** Ignore scroll snap noise while we animate to a chosen card. */
  const programmaticRef = useRef(false);
  const programTimerRef = useRef<number | null>(null);

  const beginProgrammaticScroll = useCallback((targetIndex: number) => {
    programmaticRef.current = true;
    if (programTimerRef.current != null) {
      window.clearTimeout(programTimerRef.current);
    }
    programTimerRef.current = window.setTimeout(() => {
      const el = scrollerRef.current;
      // Ensure Casual (index 0) lands flush-left after smooth scroll + snap.
      if (el && targetIndex === 0 && el.scrollLeft > 0) {
        el.scrollTo({ left: 0, behavior: "auto" });
      }
      programmaticRef.current = false;
      programTimerRef.current = null;
    }, 500);
  }, []);

  const scrollToIndex = useCallback(
    (i: number, announce = true) => {
      const el = scrollerRef.current;
      if (!el) return;
      const child = cardButtons(el)[i];
      if (!child) return;

      beginProgrammaticScroll(i);
      const left = i === 0 ? 0 : scrollLeftForCard(el, child);
      el.scrollTo({ left, behavior: "smooth" });

      setIndex(i);
      if (announce) {
        onModeChange(CAROUSEL_MODES[i]!.id);
      }
    },
    [beginProgrammaticScroll, onModeChange]
  );

  useEffect(() => {
    const i = CAROUSEL_MODES.findIndex((m) => m.id === activeMode);
    if (i < 0 || i === indexRef.current) return;
    scrollToIndex(i, false);
  }, [activeMode, scrollToIndex]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let frame = 0;
    const onScroll = () => {
      if (programmaticRef.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (programmaticRef.current) return;
        const children = cardButtons(el);
        if (children.length === 0) return;
        let best = 0;
        let bestDist = Infinity;
        children.forEach((child, i) => {
          const dist = Math.abs(scrollLeftForCard(el, child) - el.scrollLeft);
          if (dist < bestDist) {
            bestDist = dist;
            best = i;
          }
        });
        if (best === indexRef.current) return;
        setIndex(best);
        const mode = CAROUSEL_MODES[best]?.id;
        if (mode && !disabled) onModeChange(mode);
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      if (programTimerRef.current != null) {
        window.clearTimeout(programTimerRef.current);
      }
    };
  }, [disabled, onModeChange]);

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-end justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.22em] text-secondary/90">
            Swipe match modes
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Casual, ranked, stake, or private room
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-primary/30 bg-card/50 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {CAROUSEL_MODES.length} modes
        </span>
      </div>

      <div
        ref={scrollerRef}
        className={cn(
          "lobby-mode-carousel flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain",
          "touch-pan-x [-webkit-overflow-scrolling:touch]",
          "no-scrollbar scroll-smooth"
        )}
      >
        {CAROUSEL_MODES.map((m, i) => {
          const active = index === i;
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              aria-current={active ? "true" : undefined}
              onClick={() => {
                if (disabled) return;
                if (i === index) return;
                scrollToIndex(i);
              }}
              className={cn(
                "relative shrink-0 snap-start overflow-hidden rounded-2xl border text-left transition-[border-color,opacity,box-shadow] duration-200",
                "w-[min(88%,22rem)] sm:w-[min(72%,24rem)] md:w-[min(58%,26rem)]",
                "min-h-[9.5rem] sm:min-h-[10.5rem]",
                active
                  ? "border-primary/60 shadow-[0_0_28px_rgba(168,85,247,0.28)] opacity-100"
                  : "border-primary/20 opacity-75",
                disabled ? "cursor-not-allowed" : "cursor-pointer"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-[#12082a] to-accent/25" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
              <div className="relative flex h-full min-h-[9.5rem] flex-col justify-end p-4 sm:min-h-[10.5rem] sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Image
                    src={m.icon}
                    alt=""
                    width={36}
                    height={36}
                    className="h-8 w-8 sm:h-9 sm:w-9"
                  />
                  <span className="text-[10px] uppercase tracking-wider text-secondary">
                    Mode {i + 1}
                  </span>
                </div>
                <h3 className="font-heading text-xl text-white sm:text-2xl">
                  {m.label}
                </h3>
                <p className="mt-1 text-xs text-white/70 sm:text-sm">{m.blurb}</p>
              </div>
            </button>
          );
        })}
        <div
          className="w-[12%] shrink-0 snap-end sm:w-[28%] md:w-[42%]"
          aria-hidden
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-0.5">
        <div className="flex flex-wrap gap-1.5">
          {CAROUSEL_MODES.map((m, i) => (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              aria-label={`Go to ${m.label}`}
              onClick={() => scrollToIndex(i)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                index === i
                  ? "bg-emerald-400 text-black"
                  : "border border-white/15 bg-muted/40 text-muted-foreground hover:bg-muted/70",
                disabled ? "cursor-not-allowed" : "cursor-pointer"
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {index + 1} / {CAROUSEL_MODES.length}
        </span>
      </div>
    </div>
  );
}
