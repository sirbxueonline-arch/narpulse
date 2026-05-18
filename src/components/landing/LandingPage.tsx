"use client";

import { useLocale, useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  Droplet,
  Clock3,
  TriangleAlert,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Activity,
  Database,
  MapPin,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

type Stats = {
  activeOutages: number;
  locationsReporting: number;
  totalPins: number;
};

export default function LandingPage({ stats }: { stats: Stats }) {
  const t = useTranslations("home");
  const locale = useLocale();

  return (
    <section className="flex-1">
      {/* Hero */}
      <div className="relative overflow-hidden np-hero-bg np-grain">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-16 sm:pt-24 pb-20">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--text-soft)] backdrop-blur"
              >
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>Openwave 2026</span>
                <span className="text-[var(--muted)]">·</span>
                <span>Nərimanov rayonu</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.05 }}
                className="text-[2.5rem] sm:text-6xl lg:text-[4.5rem] font-extrabold tracking-tight leading-[1.02]"
              >
                {t("heroTitle")}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.1 }}
                className="text-lg sm:text-xl text-[var(--text-soft)] max-w-xl leading-relaxed"
              >
                {t("heroSub")}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.18 }}
                className="flex flex-wrap items-center gap-3 pt-2"
              >
                <Link
                  href="/kesintiler"
                  className="group inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-2)] transition-all shadow-[0_12px_30px_-10px_rgba(200,16,46,0.45)] hover:shadow-[0_14px_36px_-8px_rgba(200,16,46,0.55)] hover:-translate-y-0.5"
                >
                  {t("ctaPrimary")}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  href="/giris"
                  className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-white border border-[var(--border)] text-[var(--text)] font-semibold hover:bg-[var(--surface-2)] transition-colors"
                >
                  {t("ctaSecondary")}
                </Link>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="lg:col-span-5"
            >
              <HeroPreview stats={stats} />
            </motion.div>
          </div>

          {/* Stat strip below */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.32 }}
            className="mt-14 grid grid-cols-3 gap-3 sm:gap-6 max-w-3xl"
          >
            <Stat
              value={stats.activeOutages}
              label={t("statActive")}
              icon={<Activity className="h-4 w-4" />}
              color="var(--accent)"
              bg="var(--accent-soft)"
              live
            />
            <Stat
              value={stats.locationsReporting}
              label={t("statQueues")}
              icon={<MapPin className="h-4 w-4" />}
              color="var(--warning)"
              bg="var(--warning-soft)"
            />
            <Stat
              value={stats.totalPins}
              label={t("statPins")}
              icon={<TriangleAlert className="h-4 w-4" />}
              color="var(--success)"
              bg="var(--success-soft)"
            />
          </motion.div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            {locale === "az" ? "Üç tab. Bir rayon." : "Three tabs. One district."}
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">
            {locale === "az"
              ? "Sakinlər soruşur. NarPulse cavab verir."
              : "Residents ask. NarPulse answers."}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            href="/kesintiler"
            icon={<Droplet className="h-5 w-5" />}
            title={t("feature1Title")}
            desc={t("feature1Desc")}
            tint="accent"
          />
          <FeatureCard
            href="/novbeler"
            icon={<Clock3 className="h-5 w-5" />}
            title={t("feature2Title")}
            desc={t("feature2Desc")}
            tint="warning"
          />
          <FeatureCard
            href="/tehlukesizlik"
            icon={<TriangleAlert className="h-5 w-5" />}
            title={t("feature3Title")}
            desc={t("feature3Desc")}
            tint="success"
          />
        </div>
      </div>

      {/* Open data pitch */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-24">
        <div className="np-card p-8 sm:p-12 grid lg:grid-cols-5 gap-8 items-center">
          <div className="lg:col-span-3 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--success-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--success)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {locale === "az" ? "Açıq məlumat" : "Open data"}
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              {t("openDataTitle")}
            </h2>
            <p className="text-[var(--text-soft)] leading-relaxed">
              {t("openDataBody")}
            </p>
            <Link
              href="/haqqinda"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-2)] pt-2"
            >
              {t("tryNow")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[var(--border)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--warning)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
                <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold text-[var(--muted)]">
                  narpulse.az / api
                </span>
              </div>
              <div className="px-4 py-3 space-y-2 font-mono text-[12px]">
                <CodeRow label="GET" path="/api/outages" />
                <CodeRow label="GET" path="/api/locations" />
                <CodeRow label="GET" path="/api/safety-pins" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
              <Database className="h-3 w-3" />
              {locale === "az"
                ? "Hamısı pulsuz · JSON · açıq lisenziya"
                : "All free · JSON · open license"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroPreview({ stats }: { stats: Stats }) {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-[var(--warning)]/10 blur-2xl" />
      <div className="relative rounded-3xl bg-white border border-[var(--border)] shadow-[0_24px_60px_-20px_rgba(28,24,16,0.18)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-[var(--accent)] animate-ping opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-soft)]">
              Live · Nərimanov
            </span>
          </div>
          <span className="text-[10px] text-[var(--muted)] tabular">
            {new Date().toLocaleTimeString("az-AZ", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="p-5 space-y-3">
          <PreviewRow
            color="var(--accent)"
            bg="var(--accent-soft)"
            label="8 Noyabr küç."
            sub="Su kəsintisi · ~85 dəq əvvəl"
            badge="Aktiv"
            badgeColor="var(--accent)"
          />
          <PreviewRow
            color="var(--warning)"
            bg="var(--warning-soft)"
            label="Ziya Bünyadov pr."
            sub="İşıq kəsintisi · ~38 dəq əvvəl"
            badge="Aktiv"
            badgeColor="var(--accent)"
          />
          <PreviewRow
            color="var(--success)"
            bg="var(--success-soft)"
            label="ASAN Xidmət №1"
            sub="~15 dəq gözləmə"
            badge="OK"
            badgeColor="var(--success)"
          />
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between text-[11px] font-semibold">
          <span className="text-[var(--muted)] uppercase tracking-wider">
            {stats.activeOutages} aktiv · {stats.totalPins} pin
          </span>
          <span className="text-[var(--accent)]">→</span>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({
  color,
  bg,
  label,
  sub,
  badge,
  badgeColor,
}: {
  color: string;
  bg: string;
  label: string;
  sub: string;
  badge: string;
  badgeColor: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-9 w-9 rounded-xl grid place-items-center shrink-0"
        style={{ background: bg, color }}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{label}</div>
        <div className="text-[11px] text-[var(--muted)] truncate">{sub}</div>
      </div>
      <span
        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
        style={{
          color: badgeColor,
          borderColor: badgeColor + "33",
          background: badgeColor + "11",
        }}
      >
        {badge}
      </span>
    </div>
  );
}

function Stat({
  value,
  label,
  icon,
  color,
  bg,
  live,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  live?: boolean;
}) {
  return (
    <div
      className="relative np-card p-4 sm:p-5 flex flex-col gap-2 overflow-hidden np-card-hover"
      style={{
        background: `linear-gradient(135deg, ${bg} 0%, #ffffff 70%)`,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-9 w-9 rounded-xl items-center justify-center"
          style={{ background: "#ffffff", color, border: `1px solid ${color}33` }}
        >
          {icon}
        </span>
        {live && (
          <span className="relative inline-flex h-2 w-2">
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-60"
              style={{ background: color }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ background: color }}
            />
          </span>
        )}
      </div>
      <div>
        <div
          className="text-3xl sm:text-4xl font-extrabold tabular leading-none"
          style={{ color }}
        >
          {value}
        </div>
        <div className="text-[11px] sm:text-xs text-[var(--muted)] uppercase tracking-wider mt-1.5 font-semibold leading-tight">
          {label}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  href,
  icon,
  title,
  desc,
  tint,
}: {
  href: "/kesintiler" | "/novbeler" | "/tehlukesizlik";
  icon: React.ReactNode;
  title: string;
  desc: string;
  tint: "accent" | "warning" | "success";
}) {
  const palette = {
    accent: { fg: "var(--accent)", bg: "var(--accent-soft)" },
    warning: { fg: "var(--warning)", bg: "var(--warning-soft)" },
    success: { fg: "var(--success)", bg: "var(--success-soft)" },
  }[tint];
  return (
    <Link href={href} className="group">
      <div className="np-card np-card-hover p-6 h-full flex flex-col gap-4">
        <div
          className="h-12 w-12 rounded-2xl grid place-items-center"
          style={{ background: palette.bg, color: palette.fg }}
        >
          {icon}
        </div>
        <h3 className="text-lg font-extrabold leading-tight tracking-tight">
          {title}
        </h3>
        <p className="text-sm text-[var(--text-soft)] leading-relaxed flex-1">
          {desc}
        </p>
        <div
          className="inline-flex items-center gap-1.5 text-sm font-bold pt-1"
          style={{ color: palette.fg }}
        >
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
            →
          </span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

function CodeRow({ label, path }: { label: string; path: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[9px] font-bold rounded bg-[var(--success-soft)] text-[var(--success)] px-1.5 py-0.5 uppercase tracking-wider">
        {label}
      </span>
      <code className="text-[var(--text)] tabular">{path}</code>
    </div>
  );
}
