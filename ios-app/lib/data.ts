import { getSupabase, isSupabaseConfigured } from "./supabase";
import {
  MOCK_LOCATIONS,
  MOCK_OUTAGES,
  MOCK_PINS,
  MOCK_WAITS,
} from "./mock";
import type {
  Outage,
  SafetyPin,
  ServiceLocation,
  WaitCheckin,
} from "./types";

async function safe<T>(
  run: () => Promise<{ data: T | null; error: unknown }>,
  fallback: T
): Promise<T> {
  if (!isSupabaseConfigured) return fallback;
  try {
    const { data, error } = await run();
    if (error || !data) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

export async function fetchOutages(): Promise<Outage[]> {
  const supabase = getSupabase();
  return safe<Outage[]>(
    () =>
      supabase
        .from("outages")
        .select("*")
        .order("started_at", { ascending: false }),
    MOCK_OUTAGES
  );
}

export async function fetchLocations(): Promise<ServiceLocation[]> {
  const supabase = getSupabase();
  return safe<ServiceLocation[]>(
    () => supabase.from("service_locations").select("*").order("name"),
    MOCK_LOCATIONS
  );
}

export async function fetchRecentWaits(): Promise<WaitCheckin[]> {
  const supabase = getSupabase();
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return safe<WaitCheckin[]>(
    () =>
      supabase
        .from("wait_checkins")
        .select("*")
        .gte("reported_at", sinceIso)
        .order("reported_at", { ascending: false }),
    MOCK_WAITS
  );
}

export async function fetchPins(): Promise<SafetyPin[]> {
  const supabase = getSupabase();
  return safe<SafetyPin[]>(
    () =>
      supabase
        .from("safety_pins")
        .select("*")
        .order("upvotes", { ascending: false }),
    MOCK_PINS
  );
}

export function medianMinutes(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function relativeMinutes(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return "indi";
  if (diff < 60) return `${Math.round(diff)} dəq əvvəl`;
  if (diff < 60 * 24) return `${Math.round(diff / 60)} saat əvvəl`;
  return `${Math.round(diff / (60 * 24))} gün əvvəl`;
}

export function formatClock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}
