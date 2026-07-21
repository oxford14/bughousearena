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

  const cardAt = (el: HTMLDivElement, i: number) =>
    ([...el.children].filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && node.tagName === "BUTTON"
    )[i] ?? null);

  useEffect(() => {
    const i = CAROUSEL_MODES.findIndex((m) => m.id === activeMode);
    if (i < 0 || i === indexRef.current) return;
    setIndex(i);
    const el = scrollerRef.current;
    const child = el ? cardAt(el, i) : null;
    if (el && child) {
      el.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
    }
  }, [activeMode]);

  const scrollTo = useCallback(
    (i: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const child = cardAt(el, i);
      if (!child) return;
      el.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
      setIndex(i);
      onModeChange(CAROUSEL_MODES[i]!.id);
    },
    [onModeChange]
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const children = [...el.children].filter(
          (node): node is HTMLElement =>
            node instanceof HTMLElement && node.tagName === "BUTTON"
        );
        if (children.length === 0) return;
        let best = 0;
        let bestDist = Infinity;
        children.forEach((child, i) => {
          const dist = Math.abs(child.offsetLeft - el.scrollLeft);
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

      {/* Peek next card; scrollbar fully hidden (Kaza-style swipe strip). */}
      <div
        ref={scrollerRef}
        className={cn(
          "lobby-mode-carousel flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain",
          "touch-pan-x [-webkit-overflow-scrolling:touch]",
          "no-scrollbar scroll-smooth"
        )}
        style={{ scrollPaddingInline: "0" }}
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
                scrollTo(i);
              }}
              className={cn(
                // Mobile: ~88% width so next card peeks; tablet/desktop tighten.
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
        {/* Trailing spacer so the last card can sit flush-left with peek room */}
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
              onClick={() => scrollTo(i)}
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
