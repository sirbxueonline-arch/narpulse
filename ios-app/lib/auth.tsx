import React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";

type Profile = {
  id: string;
  role: "resident" | "admin";
  display_name: string | null;
};

type Ctx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  ready: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    const supabase = getSupabase();
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!alive) return;
      setSession(s ?? null);
      if (!s) setProfile(null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (!session?.user || !isSupabaseConfigured) {
      setProfile(null);
      return;
    }
    let alive = true;
    getSupabase()
      .from("profiles")
      .select("id,role,display_name")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setProfile(data as Profile | null);
      });
    return () => {
      alive = false;
    };
  }, [session?.user]);

  const signOut = React.useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await getSupabase().auth.signOut();
    setProfile(null);
  }, []);

  const value = React.useMemo<Ctx>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      ready,
      signOut,
    }),
    [session, profile, ready, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
