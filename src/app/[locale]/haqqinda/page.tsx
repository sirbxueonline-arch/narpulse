import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight, ShieldCheck, Globe2, Heart } from "lucide-react";
import { Card } from "@/components/ui/Card";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 py-16 space-y-10">
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
          <Globe2 className="h-3.5 w-3.5 text-[var(--accent-2)]" />
          Openwave 2026
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-lg text-[var(--muted)] leading-relaxed">
          {t("lead")}
        </p>
      </header>

      <article className="prose-invert space-y-5">
        <p className="text-[var(--text)] leading-relaxed">{t("p1")}</p>
        <p className="text-[var(--text)] leading-relaxed">{t("p2")}</p>
        <p className="text-[var(--text)] leading-relaxed">{t("p3")}</p>
      </article>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5 space-y-2">
          <ShieldCheck className="h-5 w-5 text-[var(--success)]" />
          <h3 className="text-sm font-bold">
            {locale === "az" ? "Şəffaflıq" : "Transparency"}
          </h3>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            {locale === "az"
              ? "Bütün məlumat mənbələri görünür və yoxlanılan ola bilər."
              : "Every data source is visible and verifiable."}
          </p>
        </Card>
        <Card className="p-5 space-y-2">
          <Heart className="h-5 w-5 text-[var(--accent-2)]" />
          <h3 className="text-sm font-bold">
            {locale === "az" ? "Sakin üçün" : "Resident-first"}
          </h3>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            {locale === "az"
              ? "Hər ekran sakinin bir sualına cavab verir."
              : "Every screen answers a real resident's question."}
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href="https://github.com/narpulse/narpulse"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-[var(--border)] hover:bg-[var(--surface)]"
        >
          {t("openSourceBtn")}
          <ArrowRight className="h-4 w-4" />
        </a>
        <Link
          href="/kesintiler"
          className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-2)]"
        >
          {locale === "az" ? "Aktiv kəsintilərə bax" : "View active outages"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
