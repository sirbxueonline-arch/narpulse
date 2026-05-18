import { useLocale, useTranslations } from "next-intl";
import { Code2, ShieldCheck, MapPin } from "lucide-react";
import Logo from "@/components/brand/Logo";

export default function Footer() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-1">
          <Logo size={28} />
          <p className="text-xs text-[var(--muted)] leading-relaxed max-w-sm">
            {t("credit")}
          </p>
        </div>
        <div className="flex flex-col gap-2 text-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1">
            {locale === "az" ? "Layihə" : "Project"}
          </p>
          <a
            href="https://github.com/narpulse/narpulse"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[var(--text-soft)] hover:text-[var(--text)] transition-colors"
          >
            <Code2 className="h-3.5 w-3.5" />
            {t("viewSource")}
          </a>
          <span className="inline-flex items-center gap-1.5 text-[var(--text-soft)]">
            <MapPin className="h-3.5 w-3.5" />
            Nərimanov · Bakı · AZ
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--success)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("openData")}
          </span>
        </div>
        <div className="flex flex-col gap-2 text-xs lg:items-end">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1">
            {locale === "az" ? "Tərəfdaşlar" : "Partners"}
          </p>
          <span className="text-[var(--text-soft)]">İRİA</span>
          <span className="text-[var(--text-soft)]">Nərimanov RİH</span>
          <span className="text-[var(--text-soft)]">Tedspace</span>
        </div>
      </div>
      <div className="border-t border-[var(--border)] py-4 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
          <span>
            © {year} NarPulse — Openwave 2026.
          </span>
          <span>
            {locale === "az"
              ? "MIT lisenziyalı açıq mənbə kodu"
              : "Open source · MIT licensed"}
          </span>
        </div>
      </div>
    </footer>
  );
}
