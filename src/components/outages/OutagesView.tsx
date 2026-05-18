"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import { Droplet, Zap, Flame, Layers } from "lucide-react";
import BaseMap from "@/components/map/BaseMap";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { UtilityIcon, utilityLabel, utilityColor } from "./utility";
import { relativeTime, formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Outage, Utility } from "@/lib/supabase/types";

type Filter = "all" | Utility;

export default function OutagesView({ initial }: { initial: Outage[] }) {
  const t = useTranslations("outages");
  const locale = useLocale();
  const { toast } = useToast();
  const [outages, setOutages] = React.useState<Outage[]>(initial);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [showResolved, setShowResolved] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const mapRef = React.useRef<MlMap | null>(null);
  const markersRef = React.useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupsRef = React.useRef<Map<string, maplibregl.Popup>>(new Map());

  const filtered = React.useMemo(() => {
    return outages.filter((o) => {
      if (filter !== "all" && o.utility !== filter) return false;
      if (!showResolved && o.status === "resolved") return false;
      return true;
    });
  }, [outages, filter, showResolved]);

  // Realtime subscription
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("outages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "outages" },
        (payload) => {
          const newOutage = payload.new as Outage;
          setOutages((prev) => [newOutage, ...prev]);
          if (newOutage.status === "active") {
            toast({
              title: t("newOutageToast"),
              description: newOutage.area_name,
              variant: "alert",
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "outages" },
        (payload) => {
          const updated = payload.new as Outage;
          setOutages((prev) =>
            prev.map((o) => (o.id === updated.id ? updated : o))
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [t, toast]);

  // Render markers when filtered changes or map ready
  const renderMarkers = React.useCallback(
    (map: MlMap, items: Outage[]) => {
      const seen = new Set<string>();
      items.forEach((o) => {
        seen.add(o.id);
        const existing = markersRef.current.get(o.id);
        if (existing) {
          existing.setLngLat([o.center_lng, o.center_lat]);
          return;
        }
        const el = document.createElement("div");
        el.className = "np-pulse-marker " + statusClass(o.status);
        el.innerHTML = `<span class="np-pulse-marker__ring"></span><span class="np-pulse-marker__dot"></span>`;
        el.style.cursor = "pointer";
        const stripeColor = utilityColor(o.utility);
        const statusBg =
          o.status === "active"
            ? "rgba(200,16,46,0.10)"
            : o.status === "planned"
            ? "rgba(184,117,20,0.12)"
            : "rgba(19,138,91,0.12)";
        const statusFg =
          o.status === "active"
            ? "#a50c24"
            : o.status === "planned"
            ? "#b87514"
            : "#138a5b";
        const popupHtml = `
          <div style="min-width:240px;padding-left:8px;border-left:3px solid ${stripeColor}">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <span style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${stripeColor}">${utilityLabel(
          o.utility,
          locale
        )}</span>
              <span style="display:inline-flex;align-items:center;font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;background:${statusBg};color:${statusFg};padding:2px 7px;border-radius:999px">${statusLabel(
          o.status,
          locale
        )}</span>
            </div>
            <div style="font-weight:700;font-size:0.95rem;color:#1a1f2e;line-height:1.25">${escapeHtml(
              o.area_name
            )}</div>
            ${
              o.description
                ? `<div style="font-size:0.82rem;color:#4a5266;margin-top:6px;line-height:1.45">${escapeHtml(
                    o.description
                  )}</div>`
                : ""
            }
            ${
              o.estimated_end
                ? `<div style="font-size:0.72rem;color:#1a1f2e;margin-top:10px;display:inline-flex;align-items:center;gap:5px;background:#f4f1e9;padding:4px 9px;border-radius:7px;font-weight:600">⏱ ${
                    locale === "az" ? "Təxmini bitmə" : "ETA"
                  } ${formatClock(o.estimated_end)}</div>`
                : ""
            }
            ${
              o.source
                ? `<div style="font-size:0.62rem;color:#6e7484;margin-top:8px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700">${escapeHtml(
                    sourceLabel(o.source, locale)
                  )}</div>`
                : ""
            }
          </div>`;
        const popup = new maplibregl.Popup({
          offset: 16,
          closeButton: true,
          maxWidth: "260px",
        }).setHTML(popupHtml);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([o.center_lng, o.center_lat])
          .setPopup(popup)
          .addTo(map);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedId(o.id);
        });
        markersRef.current.set(o.id, marker);
        popupsRef.current.set(o.id, popup);
      });
      markersRef.current.forEach((m, id) => {
        if (!seen.has(id)) {
          m.remove();
          markersRef.current.delete(id);
          popupsRef.current.delete(id);
        }
      });
    },
    [locale]
  );

  const onMapReady = React.useCallback(
    (map: MlMap) => {
      mapRef.current = map;
      renderMarkers(map, filtered);
    },
    [filtered, renderMarkers]
  );

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    renderMarkers(map, filtered);
  }, [filtered, renderMarkers]);

  const flyTo = React.useCallback((o: Outage) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [o.center_lng, o.center_lat],
      zoom: 15.2,
      speed: 1.4,
    });
    const popup = popupsRef.current.get(o.id);
    const marker = markersRef.current.get(o.id);
    if (popup && marker) {
      marker.setPopup(popup);
      popup.addTo(map);
    }
    setSelectedId(o.id);
  }, []);

  const activeCount = outages.filter((o) => o.status === "active").length;

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      {/* Map */}
      <div className="relative flex-1 lg:order-2 min-h-[55vh] lg:min-h-0">
        <BaseMap onReady={onMapReady} />
        {/* Filter chips */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-1.5">
          {([
            { key: "all", label: t("filterAll"), icon: Layers },
            { key: "water", label: t("filterWater"), icon: Droplet },
            { key: "electricity", label: t("filterElectric"), icon: Zap },
            { key: "gas", label: t("filterGas"), icon: Flame },
          ] as const).map((chip) => {
            const active = filter === chip.key;
            const Icon = chip.icon;
            return (
              <button
                key={chip.key}
                onClick={() => setFilter(chip.key as Filter)}
                className={cn(
                  "h-9 px-3.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border transition-all shadow-sm",
                  active
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_4px_12px_-4px_rgba(200,16,46,0.4)]"
                    : "bg-white border-[var(--border)] text-[var(--text-soft)] hover:text-[var(--text)] hover:border-[var(--border-strong)]"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {chip.label}
              </button>
            );
          })}
          <button
            onClick={() => setShowResolved((s) => !s)}
            className={cn(
              "h-9 px-3.5 rounded-full text-xs font-bold border transition-all shadow-sm",
              showResolved
                ? "bg-[var(--text)] border-[var(--text)] text-white"
                : "bg-white border-[var(--border)] text-[var(--text-soft)] hover:text-[var(--text)] hover:border-[var(--border-strong)]"
            )}
          >
            {t("showResolved")}
          </button>
        </div>
        {/* Live indicator */}
        <div className="absolute bottom-6 left-4 inline-flex items-center gap-2 rounded-full bg-white border border-[var(--border)] pl-2.5 pr-3.5 py-1.5 text-xs shadow-md">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-[var(--accent)] animate-ping opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
          </span>
          <span className="font-semibold tabular">
            {activeCount} {t("statusActive").toLowerCase()}
          </span>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="lg:w-[380px] lg:order-1 border-t lg:border-t-0 lg:border-r border-[var(--border)] bg-[var(--surface)] flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h1 className="text-lg font-bold">{t("title")}</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">{t("subtitle")}</p>
        </div>
        <ul className="flex-1 overflow-auto divide-y divide-[var(--border)]">
          {filtered.length === 0 && (
            <li className="px-5 py-8 text-sm text-[var(--muted)] text-center">
              {t("emptyList")}
            </li>
          )}
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                onClick={() => flyTo(o)}
                className={cn(
                  "group relative w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-[var(--surface-2)] transition-colors",
                  selectedId === o.id && "bg-[var(--surface-2)]"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full transition-opacity",
                    selectedId === o.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                  style={{ background: utilityColor(o.utility) }}
                />
                <div
                  className="h-10 w-10 shrink-0 rounded-xl grid place-items-center"
                  style={{
                    background: `${utilityColor(o.utility)}1a`,
                    color: utilityColor(o.utility),
                  }}
                >
                  <UtilityIcon utility={o.utility} className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">
                      {o.area_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge
                      variant={
                        o.status === "active"
                          ? "active"
                          : o.status === "planned"
                          ? "planned"
                          : "resolved"
                      }
                    >
                      {statusLabel(o.status, locale)}
                    </Badge>
                    <span className="text-xs text-[var(--muted)]">
                      {relativeTime(o.started_at, locale)}
                    </span>
                  </div>
                  {o.estimated_end && o.status !== "resolved" && (
                    <p className="text-xs text-[var(--muted)] mt-1.5">
                      {t("estEnd")}: {formatClock(o.estimated_end)}
                    </p>
                  )}
                  {o.source && (
                    <p className="text-[10px] text-[var(--muted)] mt-1.5 uppercase tracking-wider font-semibold">
                      {sourceLabel(o.source, locale)}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function statusClass(s: Outage["status"]) {
  if (s === "active") return "";
  if (s === "planned") return "np-pulse-marker--warning";
  return "np-pulse-marker--muted";
}

function statusLabel(s: Outage["status"], locale: string) {
  const map = {
    active: { az: "Aktiv", en: "Active" },
    planned: { az: "Planlı", en: "Planned" },
    resolved: { az: "Həll edildi", en: "Resolved" },
  } as const;
  return map[s][locale === "az" ? "az" : "en"];
}

function sourceLabel(source: NonNullable<Outage["source"]>, locale: string) {
  const map = {
    azersu: { az: "Mənbə: Azərsu", en: "Source: Azərsu" },
    azerisiq: { az: "Mənbə: Azərişıq", en: "Source: Azərişıq" },
    socar: { az: "Mənbə: SOCAR", en: "Source: SOCAR" },
    manual: { az: "Mənbə: RİH", en: "Source: District office" },
  } as const;
  return map[source][locale === "az" ? "az" : "en"];
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
