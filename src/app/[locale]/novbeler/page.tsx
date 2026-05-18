import { setRequestLocale } from "next-intl/server";
import { fetchRecentWaits, fetchServiceLocations } from "@/lib/data";
import QueuesView from "@/components/queues/QueuesView";

export const revalidate = 30;

export default async function QueuesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [locations, waits] = await Promise.all([
    fetchServiceLocations(),
    fetchRecentWaits(),
  ]);
  return <QueuesView locations={locations} initialWaits={waits} />;
}
