"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  ensureUserProfile,
  subscribeToAuth,
} from "@/lib/firebase/auth";
import { getFirebaseDb } from "@/lib/firebase/config";
import type { UserProfile } from "@/types/firestore";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const next = await ensureUserProfile(user);
    setProfile(next);
  };

  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const nextProfile = await ensureUserProfile(nextUser);
        setProfile(nextProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const ref = doc(getFirebaseDb(), "users", user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        setProfile({ uid: user.uid, ...snap.data() } as UserProfile);
      },
      (error) => {
        console.error("[auth] profile snapshot failed", error);
      }
    );
  }, [user?.uid]);

  const value = useMemo(
    () => ({ user, profile, loading, refreshProfile }),
    [user, profile, loading]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
