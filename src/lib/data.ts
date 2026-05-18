import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/middleware";
import type {
  Outage,
  SafetyPin,
  ServiceLocation,
  WaitCheckin,
} from "@/lib/supabase/types";
import { MOCK_OUTAGES, MOCK_LOCATIONS, MOCK_PINS, MOCK_WAITS } from "./mock";

async function safeQuery<T>(
  run: () => Promise<{ data: T | null; error: unknown }>,
  fallback: T
): Promise<T> {
  if (!isSupabaseConfigured()) return fallback;
  try {
    const { data, error } = await run();
    if (error || !data) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

export async function fetchOutages(): Promise<Outage[]> {
  const supabase = await createClient();
  return safeQuery<Outage[]>(
    async () =>
      await supabase
        .from("outages")
        .select("*")
        .order("started_at", { ascending: false }),
    MOCK_OUTAGES
  );
}

export async function fetchServiceLocations(): Promise<ServiceLocation[]> {
  const supabase = await createClient();
  return safeQuery<ServiceLocation[]>(
    async () =>
      await supabase.from("service_locations").select("*").order("name"),
    MOCK_LOCATIONS
  );
}

export async function fetchRecentWaits(): Promise<WaitCheckin[]> {
  const supabase = await createClient();
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return safeQuery<WaitCheckin[]>(
    async () =>
      await supabase
        .from("wait_checkins")
        .select("*")
        .gte("reported_at", sinceIso)
        .order("reported_at", { ascending: false }),
    MOCK_WAITS
  );
}

export async function fetchSafetyPins(): Promise<SafetyPin[]> {
  const supabase = await createClient();
  return safeQuery<SafetyPin[]>(
    async () =>
      await supabase
        .from("safety_pins")
        .select("*")
        .order("upvotes", { ascending: false }),
    MOCK_PINS
  );
}

export type DashboardStats = {
  activeOutages: number;
  locationsReporting: number;
  totalPins: number;
};

export async function fetchHomeStats(): Promise<DashboardStats> {
  const [outages, waits, pins] = await Promise.all([
    fetchOutages(),
    fetchRecentWaits(),
    fetchSafetyPins(),
  ]);
  const activeOutages = outages.filter((o) => o.status === "active").length;
  const locationsReporting = new Set(waits.map((w) => w.location_id)).size;
  const totalPins = pins.length;
  return { activeOutages, locationsReporting, totalPins };
}
