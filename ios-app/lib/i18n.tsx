import React from "react";
import * as Localization from "expo-localization";
import az from "../messages/az.json";
import en from "../messages/en.json";

type Locale = "az" | "en";
type Messages = typeof az;

const dictionaries: Record<Locale, Messages> = { az, en };

type Ctx = {
  locale: Locale;
  t: (path: string) => string;
  setLocale: (locale: Locale) => void;
};

const I18nContext = React.createContext<Ctx | null>(null);

function pickInitialLocale(): Locale {
  try {
    const tag = Localization.getLocales()[0]?.languageCode;
    if (tag === "en") return "en";
  } catch {}
  return "az";
}

function resolve(obj: unknown, path: string): string {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  return typeof cur === "string" ? cur : path;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = React.useState<Locale>(pickInitialLocale());
  const t = React.useCallback(
    (path: string) => resolve(dictionaries[locale], path),
    [locale]
  );
  const value = React.useMemo(() => ({ locale, t, setLocale }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
