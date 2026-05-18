import { formatDistanceToNowStrict } from "date-fns";
import { az, enUS } from "date-fns/locale";

export function relativeTime(iso: string, locale: string) {
  try {
    return formatDistanceToNowStrict(new Date(iso), {
      locale: locale === "az" ? az : enUS,
      addSuffix: true,
    });
  } catch {
    return "";
  }
}

export function formatClock(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

export function formatDay(iso: string | null, locale: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "az" ? "az-AZ" : "en-GB", {
    day: "2-digit",
    month: "short",
  });
}
