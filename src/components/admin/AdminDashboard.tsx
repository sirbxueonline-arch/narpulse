"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  TriangleAlert,
  CheckCircle2,
  MapPin,
  PlusCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatCard } from "./StatCard";
import { UtilityIcon, utilityLabel } from "@/components/outages/utility";
import { relativeTime } from "@/lib/format";
import type {
  Outage,
  SafetyPin,
  ServiceLocation,
  WaitCheckin,
  SafetyCategory,
} from "@/lib/supabase/types";

export default function AdminDashboard({
  outages: outagesInitial,
  pins: pinsInitial,
  locations,
  waits,
}: {
  outages: Outage[];
  pins: SafetyPin[];
  locations: ServiceLocation[];
  waits: WaitCheckin[];
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [outages] = React.useState(outagesInitial);
  const [pins] = React.useState(pinsInitial);

  const { activeCount, newPins24h, resolvedThisWeek } = React.useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const nowMs = Date.now();
    return {
      activeCount: outages.filter((o) => o.status === "active").length,
      newPins24h: pins.filter(
        (p) => nowMs - new Date(p.created_at).getTime() < 24 * 60 * 60 * 1000
      ).length,
      resolvedThisWeek:
        outages.filter(
          (o) =>
            o.status === "resolved" &&
            o.resolved_at &&
            nowMs - new Date(o.resolved_at).getTime() < 7 * 24 * 60 * 60 * 1000
        ).length +
        pins.filter(
          (p) =>
            p.status === "resolved" &&
            nowMs - new Date(p.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
        ).length,
    };
  }, [outages, pins]);

  const waitsByLocation = locations
    .map((loc) => {
      const recent = waits.filter((w) => w.location_id === loc.id);
      const avg =
        recent.length === 0
          ? 0
          : Math.round(
              recent.reduce((s, w) => s + w.wait_minutes, 0) / recent.length
            );
      return { name: shortName(loc.name), avg, count: recent.length };
    })
    .sort((a, b) => b.avg - a.avg);

  const topLocations = waitsByLocation.slice(0, 5);

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{t("subtitle")}</p>
        </div>
        <Badge variant="active" className="text-xs">
          {locale === "az" ? "Demo məlumat" : "Demo data"}
        </Badge>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("statActive")}
          value={activeCount}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent="red"
        />
        <StatCard
          label={t("statNewPins")}
          value={newPins24h}
          icon={<TriangleAlert className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label={t("statTopLocations")}
          value={topLocations.length}
          icon={<MapPin className="h-4 w-4" />}
          accent="muted"
          hint={
            topLocations[0]
              ? `${topLocations[0].name} · ~${topLocations[0].avg} ${
                  locale === "az" ? "dəq" : "min"
                }`
              : "—"
          }
        />
        <StatCard
          label={t("statResolved")}
          value={resolvedThisWeek}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="green"
        />
      </div>

      <Tabs defaultValue="outages">
        <TabsList>
          <TabsTrigger value="outages">{t("tabOutages")}</TabsTrigger>
          <TabsTrigger value="pins">{t("tabPins")}</TabsTrigger>
          <TabsTrigger value="insights">{t("tabInsights")}</TabsTrigger>
        </TabsList>

        <TabsContent value="outages" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("tabOutages")}</CardTitle>
              <Button size="sm" variant="primary">
                <PlusCircle className="h-3.5 w-3.5" />
                {t("addOutage")}
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
                  <tr>
                    <th className="text-left font-semibold py-2 pr-3">
                      {t("areaName")}
                    </th>
                    <th className="text-left font-semibold py-2 pr-3">
                      {t("utility")}
                    </th>
                    <th className="text-left font-semibold py-2 pr-3">
                      {t("status")}
                    </th>
                    <th className="text-left font-semibold py-2 pr-3">
                      {locale === "az" ? "Başlayıb" : "Started"}
                    </th>
                    <th className="text-right font-semibold py-2">
                      {t("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {outages.map((o) => (
                    <tr key={o.id} className="hover:bg-[var(--surface-2)]">
                      <td className="py-3 pr-3 font-medium">{o.area_name}</td>
                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
                          <UtilityIcon
                            utility={o.utility}
                            className="h-3.5 w-3.5"
                          />
                          {utilityLabel(o.utility, locale)}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge
                          variant={
                            o.status === "active"
                              ? "active"
                              : o.status === "planned"
                              ? "planned"
                              : "resolved"
                          }
                        >
                          {statusLabelT(o.status, t)}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3 text-xs text-[var(--muted)]">
                        {relativeTime(o.started_at, locale)}
                      </td>
                      <td className="py-3 text-right">
                        {o.status !== "resolved" && (
                          <Button size="sm" variant="secondary">
                            {t("markResolved")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pins" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("tabPins")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
                  <tr>
                    <th className="text-left font-semibold py-2 pr-3">
                      {locale === "az" ? "Təsvir" : "Description"}
                    </th>
                    <th className="text-left font-semibold py-2 pr-3">
                      {locale === "az" ? "Kateqoriya" : "Category"}
                    </th>
                    <th className="text-left font-semibold py-2 pr-3">
                      {locale === "az" ? "Səs" : "Votes"}
                    </th>
                    <th className="text-left font-semibold py-2 pr-3">
                      {t("status")}
                    </th>
                    <th className="text-right font-semibold py-2">
                      {t("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {[...pins]
                    .filter((p) => p.status === "pending")
                    .sort((a, b) => b.upvotes - a.upvotes)
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-[var(--surface-2)]">
                        <td className="py-3 pr-3">
                          <div className="font-medium line-clamp-1 max-w-md">
                            {p.description ?? "—"}
                          </div>
                          <div className="text-[11px] text-[var(--muted)] tabular mt-0.5">
                            {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-xs text-[var(--muted)]">
                          {catLabelT(p.category, locale)}
                        </td>
                        <td className="py-3 pr-3 font-bold tabular">
                          {p.upvotes}
                        </td>
                        <td className="py-3 pr-3">
                          <Badge variant="muted">
                            {locale === "az" ? "Gözləyir" : "Pending"}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex gap-1.5">
                            <Button size="sm" variant="secondary">
                              {t("markReviewed")}
                            </Button>
                            <Button size="sm" variant="success">
                              {t("markResolved")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("outagesOverTime")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={syntheticOutageSeries()}>
                      <CartesianGrid stroke="#e6e2d6" strokeDasharray="3 3" />
                      <XAxis dataKey="day" stroke="#6e7484" fontSize={11} />
                      <YAxis stroke="#6e7484" fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line
                        type="monotone"
                        dataKey="water"
                        stroke="#3aa1ff"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="electric"
                        stroke="#f2b441"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="gas"
                        stroke="#e63950"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("pinsByCategory")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pinsByCategory(pins, locale)}>
                      <CartesianGrid stroke="#e6e2d6" strokeDasharray="3 3" />
                      <XAxis dataKey="name" stroke="#6e7484" fontSize={11} />
                      <YAxis stroke="#6e7484" fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="#c8102e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t("waitsByLocation")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={waitsByLocation}>
                      <CartesianGrid stroke="#e6e2d6" strokeDasharray="3 3" />
                      <XAxis dataKey="name" stroke="#6e7484" fontSize={10} />
                      <YAxis stroke="#6e7484" fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="avg" fill="#3fb68b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #e6e2d6",
  borderRadius: 10,
  color: "#1a1f2e",
  fontSize: 12,
  boxShadow: "0 12px 28px -8px rgba(28,24,16,0.12)",
};

function shortName(n: string) {
  return n.replace("Mərkəzi", "").replace("saylı ", "").trim().slice(0, 22);
}

function statusLabelT(s: Outage["status"], t: (k: string) => string) {
  const map = { active: "Aktiv", planned: "Planlı", resolved: "Həll edildi" };
  // Try translation else fallback to a known key
  void t;
  return map[s];
}

function catLabelT(c: SafetyCategory, locale: string) {
  const map = {
    crossing: { az: "Keçid", en: "Crossing" },
    lighting: { az: "İşıq", en: "Lighting" },
    traffic: { az: "Nəqliyyat", en: "Traffic" },
    sidewalk: { az: "Səki", en: "Sidewalk" },
    other: { az: "Digər", en: "Other" },
  } as const;
  return map[c][locale === "az" ? "az" : "en"];
}

function pinsByCategory(pins: SafetyPin[], locale: string) {
  const cats: SafetyCategory[] = [
    "crossing",
    "lighting",
    "traffic",
    "sidewalk",
    "other",
  ];
  return cats.map((c) => ({
    name: catLabelT(c, locale),
    count: pins.filter((p) => p.category === c).length,
  }));
}

function syntheticOutageSeries() {
  const days = ["B.e.", "Ç.a.", "Çr.", "C.a.", "Cm.", "Şn.", "Bz."];
  return days.map((d, i) => ({
    day: d,
    water: 2 + ((i * 3 + 1) % 5),
    electric: 1 + ((i * 2 + 2) % 4),
    gas: ((i + 1) % 3) + 1,
  }));
}

void TriangleAlert;
