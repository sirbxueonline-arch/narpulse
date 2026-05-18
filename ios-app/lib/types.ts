export type Utility = "water" | "electricity" | "gas";
export type OutageStatus = "planned" | "active" | "resolved";
export type OutageSource = "azersu" | "azerisiq" | "socar" | "manual";

export type Outage = {
  id: string;
  utility: Utility;
  status: OutageStatus;
  area_name: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  started_at: string;
  estimated_end: string | null;
  resolved_at: string | null;
  source: OutageSource | null;
  source_url: string | null;
  description: string | null;
  created_at: string;
};

export type ServiceKind = "asan" | "poliklinika" | "post" | "rih" | "bank";

export type ServiceLocation = {
  id: string;
  name: string;
  kind: ServiceKind;
  lat: number;
  lng: number;
  address: string | null;
  opens_at: string | null;
  closes_at: string | null;
};

export type WaitCheckin = {
  id: string;
  location_id: string;
  user_id: string | null;
  wait_minutes: number;
  reported_at: string;
};

export type SafetyCategory =
  | "crossing"
  | "lighting"
  | "traffic"
  | "sidewalk"
  | "other";

export type SafetyStatus = "pending" | "reviewed" | "resolved";

export type SafetyPin = {
  id: string;
  user_id: string | null;
  lat: number;
  lng: number;
  category: SafetyCategory;
  description: string | null;
  photo_url: string | null;
  upvotes: number;
  status: SafetyStatus;
  created_at: string;
};

export type Profile = {
  id: string;
  role: "resident" | "admin";
  display_name: string | null;
  district: string;
};
