import { Droplet, Zap, Flame } from "lucide-react";
import type { Utility } from "@/lib/supabase/types";

export function UtilityIcon({
  utility,
  className,
}: {
  utility: Utility;
  className?: string;
}) {
  const map = {
    water: Droplet,
    electricity: Zap,
    gas: Flame,
  } as const;
  const Icon = map[utility];
  return <Icon className={className} />;
}

export function utilityColor(utility: Utility) {
  switch (utility) {
    case "water":
      return "#3aa1ff";
    case "electricity":
      return "#f2b441";
    case "gas":
      return "#e63950";
  }
}

export function utilityLabel(utility: Utility, locale: string) {
  const map: Record<Utility, { az: string; en: string }> = {
    water: { az: "Su", en: "Water" },
    electricity: { az: "İşıq", en: "Electricity" },
    gas: { az: "Qaz", en: "Gas" },
  };
  return map[utility][locale === "az" ? "az" : "en"];
}
