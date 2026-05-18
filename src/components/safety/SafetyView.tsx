"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import {
  Plus,
  X,
  Camera,
  ThumbsUp,
  Footprints,
  Lightbulb,
  Car,
  ShieldAlert,
  MapPinned,
  TriangleAlert,
} from "lucide-react";
import BaseMap from "@/components/map/BaseMap";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SafetyCategory, SafetyPin } from "@/lib/supabase/types";

const CATEGORIES: { value: SafetyCategory; iconKey: string }[] = [
  { value: "crossing", iconKey: "crossing" },
  { value: "lighting", iconKey: "lighting" },
  { value: "traffic", iconKey: "traffic" },
  { value: "sidewalk", iconKey: "sidewalk" },
  { value: "other", iconKey: "other" },
];

function CategoryIcon({
  category,
  className,
}: {
  category: SafetyCategory;
  className?: string;
}) {
  switch (category) {
    case "crossing":
      return <Footprints className={className} />;
    case "lighting":
      return <Lightbulb className={className} />;
    case "traffic":
      return <Car className={className} />;
    case "sidewalk":
      return <MapPinned className={className} />;
    case "other":
      return <ShieldAlert className={className} />;
  }
}

export default function SafetyView({ initial }: { initial: SafetyPin[] }) {
  const t = useTranslations("safety");
  const locale = useLocale();
  const { toast } = useToast();

  const [pins, setPins] = React.useState<SafetyPin[]>(initial);
  const [sort, setSort] = React.useState<"popular" | "newest">("popular");
  const [dropMode, setDropMode] = React.useState(false);
  const [dropCoords, setDropCoords] =
    React.useState<{ lat: number; lng: number } | null>(null);
  const [category, setCategory] = React.useState<SafetyCategory>("crossing");
  const [description, setDescription] = React.useState("");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [votedIds, setVotedIds] = React.useState<Set<string>>(new Set());

  const mapRef = React.useRef<MlMap | null>(null);
  const markersRef = React.useRef<Map<string, maplibregl.Marker>>(new Map());
  const tempMarkerRef = React.useRef<maplibregl.Marker | null>(null);

  const sorted = React.useMemo(() => {
    const arr = [...pins];
    if (sort === "popular") arr.sort((a, b) => b.upvotes - a.upvotes);
    else
      arr.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    return arr;
  }, [pins, sort]);

  // Realtime subscription
  React.useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("pins-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "safety_pins" },
        (payload) => {
          setPins((prev) => [payload.new as SafetyPin, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "safety_pins" },
        (payload) => {
          setPins((prev) =>
            prev.map((p) =>
              p.id === (payload.new as SafetyPin).id
                ? (payload.new as SafetyPin)
                : p
            )
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const renderPinMarkers = React.useCallback(
    (map: MlMap) => {
      const seen = new Set<string>();
      pins.forEach((p) => {
        seen.add(p.id);
        if (markersRef.current.has(p.id)) return;
        const el = document.createElement("div");
        el.style.cssText = `
          width:32px;height:32px;border-radius:999px;
          background:#c8102e;color:white;
          display:grid;place-items:center;
          border:2.5px solid #ffffff;
          box-shadow:0 4px 14px rgba(0,0,0,0.4), 0 0 0 1px rgba(200,16,46,0.4);
          cursor:pointer;
          transition:box-shadow 0.15s ease, filter 0.15s ease;
          will-change:filter`;
        el.addEventListener("mouseenter", () => {
          el.style.filter = "brightness(1.1)";
          el.style.boxShadow = "0 6px 22px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.8)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.filter = "";
          el.style.boxShadow = "0 4px 14px rgba(0,0,0,0.4), 0 0 0 1px rgba(200,16,46,0.4)";
        });
        el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 17H3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedId(p.id);
          map.flyTo({ center: [p.lng, p.lat], zoom: 16, speed: 1.3 });
        });
        markersRef.current.set(p.id, marker);
      });
      markersRef.current.forEach((m, id) => {
        if (!seen.has(id)) {
          m.remove();
          markersRef.current.delete(id);
        }
      });
    },
    [pins]
  );

  const onReady = React.useCallback(
    (map: MlMap) => {
      mapRef.current = map;
      renderPinMarkers(map);
    },
    [renderPinMarkers]
  );

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    renderPinMarkers(map);
  }, [renderPinMarkers]);

  // Drop mode click handler
  const handleMapClick = React.useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!dropMode) return;
      const { lng, lat } = e.lngLat;
      setDropCoords({ lat, lng });
      const map = mapRef.current;
      if (!map) return;
      tempMarkerRef.current?.remove();
      const el = document.createElement("div");
      el.style.cssText = `
        width:32px;height:32px;border-radius:999px;
        background:#e63950;color:white;
        display:grid;place-items:center;
        border:3px solid #ffffff;
        box-shadow:0 0 0 6px rgba(230,57,80,0.25)`;
      el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="m12 3 9 17H3Z"/></svg>`;
      tempMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);
    },
    [dropMode]
  );

  const cancelDrop = () => {
    setDropMode(false);
    setDropCoords(null);
    tempMarkerRef.current?.remove();
    tempMarkerRef.current = null;
  };

  const submitPin = async () => {
    if (!dropCoords) return;
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: t("loginToPin"), variant: "warning" });
      setSubmitting(false);
      cancelDrop();
      return;
    }
    let photo_url: string | null = null;
    if (photoFile) {
      const path = `${user.id}/${Date.now()}_${photoFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("safety-photos")
        .upload(path, photoFile);
      if (!upErr) {
        const { data } = supabase.storage
          .from("safety-photos")
          .getPublicUrl(path);
        photo_url = data.publicUrl;
      }
    }
    const { error } = await supabase.from("safety_pins").insert({
      lat: dropCoords.lat,
      lng: dropCoords.lng,
      category,
      description: description.trim() || null,
      photo_url,
      user_id: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: t("loginToPin"), description: error.message, variant: "warning" });
    } else {
      toast({ title: t("thanks"), variant: "success" });
      setDescription("");
      setPhotoFile(null);
      cancelDrop();
    }
  };

  const upvote = async (id: string) => {
    if (votedIds.has(id)) return;
    setPins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, upvotes: p.upvotes + 1 } : p))
    );
    setVotedIds((s) => new Set(s).add(id));
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: t("loginToPin"), variant: "warning" });
      return;
    }
    await supabase.from("pin_votes").insert({ pin_id: id, user_id: user.id });
  };

  const selectedPin = pins.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      <div className="relative flex-1 min-h-[50vh] lg:min-h-0">
        <BaseMap
          onReady={onReady}
          onMapClick={handleMapClick}
          cursor={dropMode ? "crosshair" : ""}
        />
        <div className="absolute top-4 right-4 z-10">
          {!dropMode ? (
            <Button onClick={() => setDropMode(true)} className="shadow-2xl">
              <Plus className="h-4 w-4" />
              {t("addPin")}
            </Button>
          ) : (
            <div className="rounded-xl border border-[var(--accent)] bg-[var(--surface)]/95 backdrop-blur p-2 flex items-center gap-2 shadow-xl">
              <span className="text-xs text-[var(--text)] px-2">
                {t("dropModeHint")}
              </span>
              <Button size="sm" variant="ghost" onClick={cancelDrop}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        {dropCoords && (
          <div className="absolute inset-x-0 bottom-0 lg:left-auto lg:right-4 lg:bottom-4 lg:w-[380px]">
            <div className="m-4 lg:m-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">{t("addPin")}</h3>
                  <p className="text-[11px] text-[var(--muted)] tabular">
                    {dropCoords.lat.toFixed(4)}, {dropCoords.lng.toFixed(4)}
                  </p>
                </div>
                <button onClick={cancelDrop} className="text-[var(--muted)] hover:text-[var(--text)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase text-[var(--muted)] tracking-wide">
                    {t("categoryLabel")}
                  </label>
                  <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                    {CATEGORIES.map(({ value }) => {
                      const active = category === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setCategory(value)}
                          className={cn(
                            "h-12 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors",
                            active
                              ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-2)]"
                              : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]"
                          )}
                          title={catLabelT(value, t)}
                        >
                          <CategoryIcon category={value} className="h-4 w-4" />
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[var(--muted)] mt-1 text-center">
                    {catLabelT(category, t)}
                  </p>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase text-[var(--muted)] tracking-wide">
                    {t("descLabel")}
                  </label>
                  <Textarea
                    placeholder={t("descPlaceholder")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase text-[var(--muted)] tracking-wide">
                    {t("photoLabel")}
                  </label>
                  <label className="mt-1.5 flex items-center gap-2 px-3 h-10 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] cursor-pointer hover:border-[var(--accent)]">
                    <Camera className="h-4 w-4 text-[var(--muted)]" />
                    <span className="text-xs text-[var(--muted)] truncate">
                      {photoFile ? photoFile.name : t("photoLabel")}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        setPhotoFile(e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                </div>
                <Button
                  className="w-full"
                  onClick={submitPin}
                  disabled={submitting}
                >
                  {submitting ? "…" : t("submit")}
                </Button>
              </div>
            </div>
          </div>
        )}
        {selectedPin && !dropCoords && (
          <PinCard
            pin={selectedPin}
            voted={votedIds.has(selectedPin.id)}
            onUpvote={() => upvote(selectedPin.id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
      <aside className="lg:w-[400px] border-t lg:border-t-0 lg:border-l border-[var(--border)] bg-[var(--surface)] flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{t("title")}</h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {t("subtitle")}
            </p>
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "popular" | "newest")}
            className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs"
          >
            <option value="popular">{t("sortPopular")}</option>
            <option value="newest">{t("sortNewest")}</option>
          </select>
        </div>
        <ul className="flex-1 overflow-auto divide-y divide-[var(--border)]">
          {sorted.map((p) => {
            return (
              <li
                key={p.id}
                className={cn(
                  "px-5 py-4 flex items-start gap-3 hover:bg-[var(--surface-2)] cursor-pointer",
                  selectedId === p.id && "bg-[var(--surface-2)]"
                )}
                onClick={() => {
                  setSelectedId(p.id);
                  mapRef.current?.flyTo({
                    center: [p.lng, p.lat],
                    zoom: 16,
                    speed: 1.3,
                  });
                }}
              >
                <div className="h-9 w-9 shrink-0 rounded-xl grid place-items-center bg-[var(--accent)]/15 text-[var(--accent-2)]">
                  <CategoryIcon category={p.category} className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm leading-snug line-clamp-2">
                    {p.description ?? catLabelT(p.category, t)}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge
                      variant={
                        p.status === "resolved"
                          ? "resolved"
                          : p.status === "reviewed"
                          ? "planned"
                          : "muted"
                      }
                    >
                      {statusLabelT(p.status, t)}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted)] tabular">
                      <ThumbsUp className="h-3 w-3" />
                      {p.upvotes}
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">
                      · {relativeTime(p.created_at, locale)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

function catLabelT(c: SafetyCategory, t: (k: string) => string) {
  const k = {
    crossing: "catCrossing",
    lighting: "catLighting",
    traffic: "catTraffic",
    sidewalk: "catSidewalk",
    other: "catOther",
  } as const;
  return t(k[c]);
}

function statusLabelT(
  s: "pending" | "reviewed" | "resolved",
  t: (k: string) => string
) {
  const k = {
    pending: "statusPending",
    reviewed: "statusReviewed",
    resolved: "statusResolved",
  } as const;
  return t(k[s]);
}

function PinCard({
  pin,
  voted,
  onUpvote,
  onClose,
}: {
  pin: SafetyPin;
  voted: boolean;
  onUpvote: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("safety");
  const locale = useLocale();
  return (
    <div className="absolute inset-x-0 bottom-0 lg:left-auto lg:right-4 lg:bottom-4 lg:w-[380px]">
      <div className="m-4 lg:m-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg grid place-items-center bg-[var(--accent)]/15 text-[var(--accent-2)]">
              <CategoryIcon category={pin.category} className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {catLabelT(pin.category, t)}
              </div>
              <div className="text-[11px] text-[var(--muted)]">
                {relativeTime(pin.created_at, locale)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {pin.description && (
            <p className="text-sm leading-relaxed">{pin.description}</p>
          )}
          {pin.photo_url && (
            <div className="rounded-xl overflow-hidden border border-[var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pin.photo_url}
                alt=""
                className="w-full h-40 object-cover"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={voted ? "secondary" : "primary"}
              onClick={onUpvote}
              disabled={voted}
              className="flex-1"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              {voted ? t("alreadyVoted") : t("upvote")}
            </Button>
            <span className="inline-flex items-center gap-1 text-sm font-semibold tabular text-[var(--muted)]">
              {pin.upvotes} {t("votes")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

void TriangleAlert;
