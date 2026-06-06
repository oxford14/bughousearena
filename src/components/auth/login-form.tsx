"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  completeGoogleRedirectSignIn,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/firebase/auth";
import { formatAuthError } from "@/lib/firebase/auth-errors";
import { toast } from "sonner";
import { useSound } from "@/providers/sound-provider";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { play } = useSound();
  const nextPath = searchParams.get("next") ?? "/app/lobby";
  const [loading, setLoading] = useState(false);
  const [checkingRedirect, setCheckingRedirect] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [hostHint, setHostHint] = useState<string | null>(null);

  useEffect(() => {
    const host = window.location.hostname;
    const allowed =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".web.app") ||
      host.endsWith(".firebaseapp.com") ||
      host.endsWith(".vercel.app");
    if (!allowed) {
      setHostHint(
        `Google sign-in requires http://localhost:3000 — you are on ${window.location.host}.`
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCheckingRedirect(true);
    void completeGoogleRedirectSignIn()
      .then((user) => {
        if (cancelled || !user) return;
        play("uiSuccess");
        toast.success("Welcome to the arena!");
        router.replace(nextPath);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[auth] redirect sign-in failed", error);
        toast.error(formatAuthError(error));
      })
      .finally(() => {
        if (!cancelled) setCheckingRedirect(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nextPath, play, router]);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      play("uiSuccess");
      toast.success("Welcome to the arena!");
      router.push(nextPath);
    } catch (error) {
      if (error instanceof Error && error.message === "REDIRECT_PENDING") {
        return;
      }
      play("uiError");
      console.error("[auth] google sign-in failed", error);
      toast.error(formatAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      play("uiSuccess");
      toast.success("Welcome back!");
      router.push(nextPath);
    } catch {
      play("uiError");
      toast.error("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    try {
      await signUpWithEmail(email, password, displayName || "Arena Player");
      play("uiSuccess");
      toast.success("Account created!");
      router.push(nextPath);
    } catch {
      play("uiError");
      toast.error("Could not create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md arena-card rounded-xl border border-primary/30 p-8 bg-card/80 backdrop-blur-md">
      <h1 className="font-heading text-2xl mb-2 text-center neon-glow">Enter the Arena</h1>
      <p className="text-sm text-muted-foreground text-center mb-6">
        Sign in to play ranked, join houses, and track your stats.
      </p>

      {hostHint ? (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
          {hostHint}
        </p>
      ) : null}

      <Button
        variant="outline"
        className="w-full mb-6 cursor-pointer"
        onClick={handleGoogle}
        disabled={loading || checkingRedirect}
      >
        {loading || checkingRedirect ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {checkingRedirect ? "Completing sign-in…" : "Signing in…"}
          </>
        ) : (
          "Continue with Google"
        )}
      </Button>

      <div
        role="tablist"
        aria-orientation="horizontal"
        className="mb-4 grid h-8 w-full grid-cols-2 rounded-lg bg-muted p-[3px] text-muted-foreground"
      >
        {(["signin", "signup"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={authTab === tab}
            className={cn(
              "relative inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
              authTab === tab
                ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                : "text-foreground/60 dark:text-muted-foreground"
            )}
            onClick={() => {
              setAuthTab(tab);
              play("uiTab");
            }}
          >
            {tab === "signin" ? "Sign In" : "Sign Up"}
          </button>
        ))}
      </div>

      {authTab === "signin" ? (
        <div role="tabpanel" className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button className="w-full btn-arena-primary cursor-pointer" onClick={handleSignIn} disabled={loading}>
            Sign In
          </Button>
        </div>
      ) : (
        <div role="tabpanel" className="space-y-4">
          <div>
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="signup-email">Email</Label>
            <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="signup-password">Password</Label>
            <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button className="w-full btn-arena-primary cursor-pointer" onClick={handleSignUp} disabled={loading}>
            Create Account
          </Button>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link href="/" className="text-primary hover:underline cursor-pointer">
          Back to homepage
        </Link>
      </p>
    </div>
  );
}
