import { setRequestLocale } from "next-intl/server";
import LandingPage from "@/components/landing/LandingPage";
import { fetchHomeStats } from "@/lib/data";

export const revalidate = 60;

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const stats = await fetchHomeStats();
  return <LandingPage stats={stats} />;
}
