"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { z } from "zod";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const emailSchema = z.string().email();

export default function LoginForm() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err) {
      setErrorMsg(decodeURIComponent(err));
      setStatus("error");
    }
  }, [searchParams]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setErrorMsg("Etibarlı e-poçt daxil edin");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data,
        options: {
          emailRedirectTo:
            (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin) +
            "/auth/callback",
        },
      });
      if (error) throw error;
      setStatus("sent");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Xəta baş verdi");
    }
  };

  if (status === "sent") {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-4">
        <div className="h-12 w-12 rounded-full bg-[var(--success)]/15 grid place-items-center">
          <CheckCircle2 className="h-6 w-6 text-[var(--success)]" />
        </div>
        <div>
          <h2 className="text-lg font-bold">{t("checkInbox")}</h2>
          <p className="text-sm text-[var(--muted)] mt-1">{t("sent")}</p>
        </div>
        <button
          onClick={() => {
            setEmail("");
            setStatus("idle");
          }}
          className="text-xs text-[var(--muted)] hover:text-[var(--text)] inline-flex items-center gap-1.5 mt-2"
        >
          <ArrowLeft className="h-3 w-3" /> {t("back")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">{t("subtitle")}</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="email" className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
          {t("emailLabel")}
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
          <Input
            id="email"
            type="email"
            required
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-9"
            autoComplete="email"
          />
        </div>
      </div>
      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2.5 text-xs text-[var(--accent-2)]">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={status === "sending"}
      >
        {status === "sending" ? "…" : t("send")}
      </Button>
    </form>
  );
}
