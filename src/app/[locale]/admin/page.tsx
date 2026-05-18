import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  fetchOutages,
  fetchRecentWaits,
  fetchSafetyPins,
  fetchServiceLocations,
} from "@/lib/data";
import { getCurrentProfile } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/middleware";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { Card } from "@/components/ui/Card";
import { ShieldAlert } from "lucide-react";

export const revalidate = 60;

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  // In demo mode (no Supabase configured), allow viewing.
  if (isSupabaseConfigured()) {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      return (
        <section className="mx-auto max-w-2xl px-4 py-24">
          <Card className="p-8 text-center space-y-3">
            <div className="h-12 w-12 mx-auto rounded-full bg-[var(--accent)]/15 grid place-items-center">
              <ShieldAlert className="h-6 w-6 text-[var(--accent-2)]" />
            </div>
            <h1 className="text-xl font-bold">{t("notAuthorized")}</h1>
            <p className="text-sm text-[var(--muted)]">
              {locale === "az"
                ? "Davam etmək üçün admin hesabı ilə daxil olun."
                : "Sign in with an admin account to continue."}
            </p>
          </Card>
        </section>
      );
    }
    void redirect; // marker to avoid unused warning if not used
  }

  const [outages, pins, locations, waits] = await Promise.all([
    fetchOutages(),
    fetchSafetyPins(),
    fetchServiceLocations(),
    fetchRecentWaits(),
  ]);

  return (
    <AdminDashboard
      outages={outages}
      pins={pins}
      locations={locations}
      waits={waits}
    />
  );
}
