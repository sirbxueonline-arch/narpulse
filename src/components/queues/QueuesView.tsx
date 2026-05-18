"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import { Clock3, Building2, Stethoscope, Mailbox, Landmark, CreditCard } from "lucide-react";
import BaseMap from "@/components/map/BaseMap";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  ServiceKind,
  ServiceLocation,
  WaitCheckin,
} from "@/lib/supabase/types";

function kindIcon(kind: ServiceKind) {
  switch (kind) {
    case "asan":
      return Building2;
    case "poliklinika":
      return Stethoscope;
    case "post":
      return Mailbox;
    case "rih":
      return Landmark;
    case "bank":
      return CreditCard;
  }
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function severity(minutes: number | null) {
  if (minutes === null) return "muted";
  if (minutes >= 25) return "warn";
  if (minutes >= 12) return "mid";
  return "ok";
}

export default function QueuesView({
  locations,
  initialWaits,
}: {
  locations: ServiceLocation[];
  initialWaits: WaitCheckin[];
}) {
  const t = useTranslations("queues");
  const locale = useLocale();
  const { toast } = useToast();
  const [waits, setWaits] = React.useState<WaitCheckin[]>(initialWaits);
  const [selected, setSelected] = React.useState<ServiceLocation | null>(null);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [reportingFor, setReportingFor] = React.useState<ServiceLocation | null>(
    null
  );
  const [waitValue, setWaitValue] = React.useState(15);
  const [submitting, setSubmitting] = React.useState(false);
  const mapRef = React.useRef<MlMap | null>(null);
  const markersRef = React.useRef<Map<string, maplibregl.Marker>>(new Map());

  // Realtime subscription
  React.useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("waits-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wait_checkins" },
        (payload) => {
          setWaits((prev) => [payload.new as WaitCheckin, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const summaryByLocation = React.useMemo(() => {
    const m = new Map<
      string,
      { median: number | null; last: WaitCheckin | null }
    >();
    locations.forEach((loc) => {
      const recent = waits.filter((w) => w.location_id === loc.id);
      const med = median(recent.map((w) => w.wait_minutes));
      const last = recent[0] ?? null;
      m.set(loc.id, { median: med, last });
    });
    return m;
  }, [locations, waits]);

  // Render markers
  const onReady = React.useCallback(
    (map: MlMap) => {
      mapRef.current = map;
      locations.forEach((loc) => {
        const sum = summaryByLocation.get(loc.id);
        const sev = severity(sum?.median ?? null);
        const color =
          sev === "warn"
            ? "#c8102e"
            : sev === "mid"
            ? "#b87514"
            : sev === "ok"
            ? "#138a5b"
            : "#6e7484";
        const el = document.createElement("div");
        el.style.cssText = `
          width:36px;height:36px;border-radius:999px;
          background:${color};color:#ffffff;
          display:grid;place-items:center;
          border:2.5px solid #ffffff;
          box-shadow:0 4px 14px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.15);
          cursor:pointer;font-weight:700;font-size:12px;
          transition:box-shadow 0.15s ease, filter 0.15s ease;
          will-change:filter`;
        el.textContent = sum?.median != null ? String(sum.median) : "?";
        el.addEventListener("mouseenter", () => {
          el.style.filter = "brightness(1.1)";
          el.style.boxShadow = "0 6px 22px rgba(0,0,0,0.45), 0 0 0 2px rgba(255,255,255,0.8)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.filter = "";
          el.style.boxShadow = "0 4px 14px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.15)";
        });
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([loc.lng, loc.lat])
          .addTo(map);
        el.addEventListener("click", () => {
          setSelected(loc);
          map.flyTo({ center: [loc.lng, loc.lat], zoom: 15.2, speed: 1.4 });
        });
        markersRef.current.set(loc.id, marker);
      });
    },
    [locations, summaryByLocation]
  );

  // Update marker labels when waits change
  React.useEffect(() => {
    locations.forEach((loc) => {
      const marker = markersRef.current.get(loc.id);
      if (!marker) return;
      const sum = summaryByLocation.get(loc.id);
      const sev = severity(sum?.median ?? null);
      const color =
        sev === "warn"
          ? "#c8102e"
          : sev === "mid"
          ? "#b87514"
          : sev === "ok"
          ? "#138a5b"
          : "#6e7484";
      const el = marker.getElement();
      el.style.background = color;
      el.textContent = sum?.median != null ? String(sum.median) : "?";
    });
  }, [locations, summaryByLocation]);

  const startReport = (loc: ServiceLocation) => {
    setReportingFor(loc);
    setWaitValue(15);
    setReportOpen(true);
  };

  const submitReport = async () => {
    if (!reportingFor) return;
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: t("loginToReport"), variant: "warning" });
      setSubmitting(false);
      setReportOpen(false);
      return;
    }
    const { error } = await supabase.from("wait_checkins").insert({
      location_id: reportingFor.id,
      wait_minutes: waitValue,
      user_id: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: t("loginToReport"), description: error.message, variant: "warning" });
    } else {
      toast({ title: t("thanks"), variant: "success" });
    }
    setReportOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      <div className="relative flex-1 lg:order-1 min-h-[40vh] lg:min-h-0">
        <BaseMap onReady={onReady} />
        <QueueLegend locale={locale} />
      </div>
      <aside className="lg:w-[440px] lg:order-2 border-t lg:border-t-0 lg:border-l border-[var(--border)] bg-[var(--surface)] flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h1 className="text-lg font-bold">{t("title")}</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">{t("subtitle")}</p>
        </div>
        <ul className="flex-1 overflow-auto divide-y divide-[var(--border)]">
          {locations.map((loc) => {
            const Icon = kindIcon(loc.kind);
            const sum = summaryByLocation.get(loc.id);
            const sev = severity(sum?.median ?? null);
            return (
              <li
                key={loc.id}
                className={cn(
                  "px-5 py-4 flex items-start gap-3 hover:bg-[var(--surface-2)] transition-colors cursor-pointer",
                  selected?.id === loc.id && "bg-[var(--surface-2)]"
                )}
                onClick={() => {
                  setSelected(loc);
                  mapRef.current?.flyTo({
                    center: [loc.lng, loc.lat],
                    zoom: 15.2,
                    speed: 1.4,
                  });
                }}
              >
                <div className="h-9 w-9 shrink-0 rounded-xl grid place-items-center bg-[var(--surface-2)] text-[var(--muted)]">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{loc.name}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5 truncate">
                    {kindLabel(loc.kind, locale)} {loc.address ? "· " + loc.address : ""}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 h-6 rounded-full text-[11px] font-semibold tabular",
                        sev === "warn" && "bg-[var(--accent)]/20 text-[var(--accent-2)]",
                        sev === "mid" && "bg-[var(--warning)]/20 text-[var(--warning)]",
                        sev === "ok" && "bg-[var(--success)]/20 text-[var(--success)]",
                        sev === "muted" && "bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)]"
                      )}
                    >
                      <Clock3 className="h-3 w-3" />
                      {sum?.median != null
                        ? `~${sum.median} ${t("minutesLabel")}`
                        : t("noReport")}
                    </span>
                    {sum?.last && (
                      <span className="text-[11px] text-[var(--muted)]">
                        · {relativeTime(sum.last.reported_at, locale)}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    startReport(loc);
                  }}
                >
                  {t("reportButton")}
                </Button>
              </li>
            );
          })}
        </ul>
      </aside>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent onClose={() => setReportOpen(false)}>
          <DialogHeader>
            <DialogTitle>{t("reportTitle")}</DialogTitle>
            <DialogDescription>
              {reportingFor?.name} · {t("reportSub")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-5xl font-extrabold tabular">
                {waitValue}
                <span className="text-base text-[var(--muted)] ml-2 font-medium">
                  {t("minutesLabel")}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={120}
                step={1}
                value={waitValue}
                onChange={(e) => setWaitValue(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
                aria-label="Wait minutes"
              />
              <div className="w-full flex justify-between text-[11px] text-[var(--muted)] tabular">
                <span>0</span>
                <span>30</span>
                <span>60</span>
                <span>90</span>
                <span>120</span>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>
              {locale === "az" ? "Ləğv et" : "Cancel"}
            </Button>
            <Button onClick={submitReport} disabled={submitting}>
              {submitting ? "…" : t("reportButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function kindLabel(kind: ServiceKind, locale: string) {
  const map = {
    asan: { az: "ASAN Xidmət", en: "ASAN Service" },
    poliklinika: { az: "Poliklinika", en: "Polyclinic" },
    post: { az: "Poçt", en: "Post office" },
    rih: { az: "RİH", en: "District office" },
    bank: { az: "Bank", en: "Bank" },
  } as const;
  return map[kind][locale === "az" ? "az" : "en"];
}

function QueueLegend({ locale }: { locale: string }) {
  const az = locale === "az";
  const title = az ? "Gözləmə müddəti" : "Wait time";
  const min = az ? "dəq" : "min";
  const noReport = az ? "hesabat yox" : "no report";
  const hint = az
    ? "Rəqəm = son 1 saat üzrə median gözləmə"
    : "Number = median wait over the last hour";
  return (
    <div
      className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-2xl border border-[var(--border)] bg-white/95 backdrop-blur px-4 py-3 shadow-[0_8px_24px_-8px_rgba(28,24,16,0.18)] text-[11px]"
      role="note"
      aria-label={title}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)] mb-2">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <LegendRow color="#138a5b" label={`< 12 ${min}`} />
        <LegendRow color="#b87514" label={`12–24 ${min}`} />
        <LegendRow color="#c8102e" label={`≥ 25 ${min}`} />
        <LegendRow color="#6e7484" label={noReport} symbol="?" />
      </div>
      <div className="mt-2 pt-2 border-t border-[var(--border)] text-[10px] text-[var(--muted)]">
        {hint}
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  symbol,
}: {
  color: string;
  label: string;
  symbol?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span
        className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold text-white"
        style={{
          background: color,
          border: "2px solid white",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
        }}
      >
        {symbol ?? ""}
      </span>
      <span className="text-[var(--text-soft)] tabular">{label}</span>
    </div>
  );
}
