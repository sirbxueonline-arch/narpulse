import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("placeholder") &&
    !SUPABASE_ANON_KEY.includes("placeholder")
);

let cached: SupabaseClient | null = null;

// Stable placeholder values so createClient doesn't throw when env vars are missing.
// Any network call will simply fail and our safeQuery wrapper returns mock data.
const FALLBACK_URL = "https://placeholder.supabase.co";
const FALLBACK_KEY = "placeholder-anon-key";

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    SUPABASE_URL || FALLBACK_URL,
    SUPABASE_ANON_KEY || FALLBACK_KEY,
    {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    }
  );
  return cached;
}
