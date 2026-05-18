"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LogIn, LogOut, ShieldCheck, User as UserIcon, ChevronDown } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Profile = { role: "resident" | "admin"; display_name: string | null };

export default function UserMenu() {
  const t = useTranslations("nav");
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data.user);
      setHydrated(true);
      if (data.user) {
        supabase
          .from("profiles")
          .select("role,display_name")
          .eq("id", data.user.id)
          .maybeSingle()
          .then(({ data: p }) => alive && setProfile(p as Profile | null));
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setOpen(false);
    router.refresh();
  };

  if (!hydrated) {
    return <span className="hidden sm:inline-block h-9 w-[80px] rounded-lg bg-[var(--surface-2)] animate-pulse" />;
  }

  if (!user) {
    return (
      <Link
        href="/giris"
        className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold border border-[var(--border)] text-[var(--text)] bg-white hover:bg-[var(--surface-2)] transition-colors"
      >
        <LogIn className="h-3.5 w-3.5" />
        {t("login")}
      </Link>
    );
  }

  const initial = (user.email?.[0] ?? "?").toUpperCase();
  const label = profile?.display_name || user.email || "";
  const isAdmin = profile?.role === "admin";

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-full border border-[var(--border)] bg-white hover:bg-[var(--surface-2)] transition-colors"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="h-7 w-7 rounded-full bg-[var(--text)] text-white text-xs font-bold grid place-items-center">
          {initial}
        </span>
        <span className="hidden sm:inline text-xs font-semibold max-w-[140px] truncate">
          {label}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-[var(--muted)]" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] w-56 rounded-xl border border-[var(--border)] bg-white shadow-lg overflow-hidden z-50"
        >
          <div className="px-3.5 py-3 border-b border-[var(--border)]">
            <div className="text-xs font-bold truncate">{label}</div>
            {isAdmin ? (
              <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </div>
            ) : (
              <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                <UserIcon className="h-3 w-3" />
                Resident
              </div>
            )}
          </div>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3.5 py-2.5 text-sm hover:bg-[var(--surface-2)]"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
              {t("admin")}
            </Link>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm hover:bg-[var(--surface-2)] text-left"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
