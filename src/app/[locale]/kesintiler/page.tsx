import { setRequestLocale } from "next-intl/server";
import { fetchOutages } from "@/lib/data";
import OutagesView from "@/components/outages/OutagesView";

export const revalidate = 30;

export default async function OutagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const outages = await fetchOutages();
  return <OutagesView initial={outages} />;
}
