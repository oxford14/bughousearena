"use client";

import { useEffect, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/config";
import { useAuth } from "@/providers/auth-provider";

export interface AdminRole {
  superAdmin: boolean;
  admin: boolean;
  loading: boolean;
}

export function useSuperAdmin(): AdminRole {
  const { user } = useAuth();
  const [role, setRole] = useState<AdminRole>({
    superAdmin: false,
    admin: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setRole({ superAdmin: false, admin: false, loading: false });
      return;
    }

    const run = async () => {
      try {
        const token = await getFirebaseAuth().currentUser?.getIdToken();
        if (!token) throw new Error("No token");
        const res = await fetch("/api/admin/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as { superAdmin?: boolean; admin?: boolean };
        if (cancelled) return;
        setRole({
          superAdmin: Boolean(data.superAdmin),
          admin: Boolean(data.admin),
          loading: false,
        });
      } catch {
        if (!cancelled) {
          setRole({ superAdmin: false, admin: false, loading: false });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return role;
}
