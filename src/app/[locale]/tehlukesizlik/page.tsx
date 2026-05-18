import { setRequestLocale } from "next-intl/server";
import { fetchSafetyPins } from "@/lib/data";
import SafetyView from "@/components/safety/SafetyView";

export const revalidate = 30;

export default async function SafetyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const pins = await fetchSafetyPins();
  return <SafetyView initial={pins} />;
}
