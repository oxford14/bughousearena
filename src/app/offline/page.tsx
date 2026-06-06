import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center arena-bg">
      <h1 className="font-heading text-3xl neon-glow mb-4">You&apos;re Offline</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        Bughouse Arena needs an internet connection for multiplayer matches.
        Reconnect to continue playing.
      </p>
      <Link
        href="/app/lobby"
        className={cn(buttonVariants(), "btn-arena-primary cursor-pointer")}
      >
        Retry
      </Link>
    </div>
  );
}
