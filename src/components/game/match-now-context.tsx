"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const MatchNowContext = createContext<number>(Date.now());

export function MatchNowProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNowMs(Date.now());
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active]);

  return (
    <MatchNowContext.Provider value={nowMs}>{children}</MatchNowContext.Provider>
  );
}

export function useMatchNow(): number {
  return useContext(MatchNowContext);
}
