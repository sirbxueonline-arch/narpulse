"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchTo = (l: "az" | "en") => {
    if (l === locale) return;
    router.replace(pathname, { locale: l });
  };

  return (
    <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white p-0.5 text-[11px] font-bold">
      <button
        onClick={() => switchTo("az")}
        className={cn(
          "px-2 py-1 rounded-md transition-colors",
          locale === "az"
            ? "bg-[var(--text)] text-white"
            : "text-[var(--muted)] hover:text-[var(--text)]"
        )}
        aria-label="Azərbaycan dili"
      >
        AZ
      </button>
      <button
        onClick={() => switchTo("en")}
        className={cn(
          "px-2 py-1 rounded-md transition-colors",
          locale === "en"
            ? "bg-[var(--text)] text-white"
            : "text-[var(--muted)] hover:text-[var(--text)]"
        )}
        aria-label="English"
      >
        EN
      </button>
    </div>
  );
}
