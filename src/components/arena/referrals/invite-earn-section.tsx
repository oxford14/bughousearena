"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getMyReferralCode, applyReferralCode } from "@/lib/wallet/wallet-api";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function InviteEarnSection() {
  const { profile } = useAuth();
  const [code, setCode] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [applyCode, setApplyCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getMyReferralCode()
      .then((data) => {
        setCode(data.code);
        setReferralCount(data.referralCount);
        setCoinsEarned(data.coinsEarned);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const shareLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/login?ref=${code}`
      : `/login?ref=${code}`;

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    toast.success("Referral code copied!");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareLink);
    toast.success("Invite link copied!");
  };

  const handleApply = async () => {
    try {
      await applyReferralCode(applyCode);
      toast.success("Referral code applied!");
      setApplyCode("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not apply code.");
    }
  };

  return (
    <Card className="arena-card border-primary/20">
      <CardHeader>
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Invite & Earn
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Share your code — earn 50 coins when a friend completes their first match, and 150
          coins when they top up ₱500+.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-primary/30 bg-muted/30 px-3 py-2 font-heading text-lg tracking-widest">
                {code || "------"}
              </code>
              <Button variant="outline" size="icon" onClick={copyCode} aria-label="Copy code">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={copyLink}>
                Copy invite link
              </Button>
              <Link
                href={`/login?ref=${code}`}
                className={cn(buttonVariants({ variant: "outline" }), "flex-1 text-center")}
              >
                Preview link
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg border border-primary/20 p-3">
                <p className="text-xs text-muted-foreground uppercase">Referrals</p>
                <p className="font-heading text-xl text-primary">{referralCount}</p>
              </div>
              <div className="rounded-lg border border-primary/20 p-3">
                <p className="text-xs text-muted-foreground uppercase">Coins earned</p>
                <p className="font-heading text-xl text-primary">{coinsEarned}</p>
              </div>
            </div>
          </>
        )}

        {!profile?.referredByUid ? (
          <div className="border-t border-primary/10 pt-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Have a referral code?
            </p>
            <div className="flex gap-2">
              <Input
                value={applyCode}
                onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                maxLength={6}
              />
              <Button onClick={handleApply} disabled={!applyCode.trim()}>
                Apply
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
