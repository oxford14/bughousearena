"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/firebase/auth";
import { toast } from "sonner";
import { useSound } from "@/providers/sound-provider";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { play } = useSound();
  const nextPath = searchParams.get("next") ?? "/app/lobby";
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      play("uiSuccess");
      toast.success("Welcome to the arena!");
      router.push(nextPath);
    } catch {
      play("uiError");
      toast.error("Google sign-in failed. Check Firebase configuration.");
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

      <Button
        variant="outline"
        className="w-full mb-6 cursor-pointer"
        onClick={handleGoogle}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue with Google"}
      </Button>

      <Tabs defaultValue="signin" onValueChange={() => play("uiTab")}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="signin" className="cursor-pointer">Sign In</TabsTrigger>
          <TabsTrigger value="signup" className="cursor-pointer">Sign Up</TabsTrigger>
        </TabsList>
        <TabsContent value="signin" className="space-y-4">
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
        </TabsContent>
        <TabsContent value="signup" className="space-y-4">
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
        </TabsContent>
      </Tabs>

      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link href="/" className="text-primary hover:underline cursor-pointer">
          Back to homepage
        </Link>
      </p>
    </div>
  );
}
