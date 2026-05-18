import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import {
  theme,
  NARIMANOV_CENTER,
  NARIMANOV_DELTA,
  severityColor,
} from "@/lib/theme";
import {
  fetchLocations,
  fetchRecentWaits,
  medianMinutes,
  relativeMinutes,
} from "@/lib/data";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import ScreenHeader from "@/components/ScreenHeader";
import type { ServiceKind, ServiceLocation, WaitCheckin } from "@/lib/types";

const KIND_ICON: Record<ServiceKind, keyof typeof Ionicons.glyphMap> = {
  asan: "business",
  poliklinika: "medkit",
  post: "mail",
  rih: "library",
  bank: "card",
};

export default function QueuesScreen() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [locations, setLocations] = React.useState<ServiceLocation[]>([]);
  const [waits, setWaits] = React.useState<WaitCheckin[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [reportFor, setReportFor] = React.useState<ServiceLocation | null>(null);
  const [waitValue, setWaitValue] = React.useState("15");
  const [submitting, setSubmitting] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const mapRef = React.useRef<MapView | null>(null);

  const load = React.useCallback(async () => {
    const [locs, ws] = await Promise.all([fetchLocations(), fetchRecentWaits()]);
    setLocations(locs);
    setWaits(ws);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    const ch = supabase
      .channel("ios-waits")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wait_checkins" },
        (p) => setWaits((prev) => [p.new as WaitCheckin, ...prev])
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const summaryByLoc = React.useMemo(() => {
    const m = new Map<string, { median: number | null; last: WaitCheckin | null }>();
    locations.forEach((loc) => {
      const recent = waits.filter((w) => w.location_id === loc.id);
      m.set(loc.id, {
        median: medianMinutes(recent.map((w) => w.wait_minutes)),
        last: recent[0] ?? null,
      });
    });
    return m;
  }, [locations, waits]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const startReport = (loc: ServiceLocation) => {
    setReportFor(loc);
    setWaitValue("15");
    setStatus(null);
  };

  const submit = async () => {
    if (!reportFor) return;
    if (!user) {
      setStatus(t("common.loginRequired"));
      return;
    }
    setSubmitting(true);
    const n = Math.max(0, Math.min(240, parseInt(waitValue, 10) || 0));
    const { error } = await getSupabase().from("wait_checkins").insert({
      location_id: reportFor.id,
      wait_minutes: n,
      user_id: user.id,
    });
    setSubmitting(false);
    if (error) {
      setStatus(error.message);
    } else {
      setStatus(t("common.thanks"));
      setTimeout(() => setReportFor(null), 900);
    }
  };

  const kindLabel = (k: ServiceKind) => {
    const m: Record<ServiceKind, { az: string; en: string }> = {
      asan: { az: "ASAN", en: "ASAN" },
      poliklinika: { az: "Poliklinika", en: "Polyclinic" },
      post: { az: "Poçt", en: "Post" },
      rih: { az: "RİH", en: "District" },
      bank: { az: "Bank", en: "Bank" },
    };
    return m[k][locale];
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t("queues.title")}
        subtitle={t("queues.subtitle")}
      />

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
          style={StyleSheet.absoluteFill}
          initialRegion={{ ...NARIMANOV_CENTER, ...NARIMANOV_DELTA }}
          showsUserLocation
        >
          {locations.map((loc) => {
            const s = summaryByLoc.get(loc.id);
            const color = severityColor(s?.median ?? null);
            return (
              <Marker
                key={loc.id}
                coordinate={{ latitude: loc.lat, longitude: loc.lng }}
                onPress={() =>
                  mapRef.current?.animateToRegion(
                    {
                      latitude: loc.lat,
                      longitude: loc.lng,
                      latitudeDelta: 0.012,
                      longitudeDelta: 0.014,
                    },
                    400
                  )
                }
                tracksViewChanges={false}
              >
                <View style={[styles.qmarker, { backgroundColor: color }]}>
                  <Text style={styles.qmarkerText}>
                    {s?.median != null ? s.median : "?"}
                  </Text>
                </View>
              </Marker>
            );
          })}
        </MapView>

        <View style={styles.legend}>
          <Text style={styles.legendTitle}>{t("queues.title")}</Text>
          <View style={styles.legendRow}>
            <View
              style={[styles.legendDot, { backgroundColor: theme.colors.success }]}
            />
            <Text style={styles.legendText}>{`< 12 ${t("common.minute")}`}</Text>
          </View>
          <View style={styles.legendRow}>
            <View
              style={[styles.legendDot, { backgroundColor: theme.colors.warning }]}
            />
            <Text style={styles.legendText}>{`12-24 ${t("common.minute")}`}</Text>
          </View>
          <View style={styles.legendRow}>
            <View
              style={[styles.legendDot, { backgroundColor: theme.colors.accent }]}
            />
            <Text style={styles.legendText}>{`≥ 25 ${t("common.minute")}`}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
          />
        }
      >
        {locations.map((loc) => {
          const s = summaryByLoc.get(loc.id);
          const color = severityColor(s?.median ?? null);
          return (
            <View key={loc.id} style={styles.row}>
              <View
                style={[styles.rowIcon, { backgroundColor: theme.colors.surface2 }]}
              >
                <Ionicons
                  name={KIND_ICON[loc.kind]}
                  size={18}
                  color={theme.colors.textSoft}
                />
              </View>
              <View style={styles.rowBody}>
                <Text numberOfLines={1} style={styles.rowTitle}>
                  {loc.name}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {kindLabel(loc.kind)}
                  {loc.address ? " · " + loc.address : ""}
                </Text>
                <View style={styles.rowMeta}>
                  <View
                    style={[
                      styles.waitPill,
                      { backgroundColor: `${color}22`, borderColor: `${color}55` },
                    ]}
                  >
                    <Ionicons name="time-outline" size={11} color={color} />
                    <Text style={[styles.waitPillText, { color }]}>
                      {s?.median != null
                        ? `~${s.median} ${t("common.minute")}`
                        : t("queues.noReport")}
                    </Text>
                  </View>
                  {s?.last && (
                    <Text style={styles.rowTime}>
                      · {relativeMinutes(s.last.reported_at)}
                    </Text>
                  )}
                </View>
              </View>
              <Pressable
                onPress={() => startReport(loc)}
                style={({ pressed }) => [
                  styles.reportBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.reportBtnText}>{t("common.report")}</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={!!reportFor}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setReportFor(null)}
      >
        {reportFor && (
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{t("queues.reportTitle")}</Text>
                <Text style={styles.sheetSub}>{reportFor.name}</Text>
              </View>
              <Pressable onPress={() => setReportFor(null)} hitSlop={12}>
                <Ionicons name="close" size={22} color={theme.colors.muted} />
              </Pressable>
            </View>
            <View style={styles.bigInputWrap}>
              <TextInput
                value={waitValue}
                onChangeText={(v) => setWaitValue(v.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                maxLength={3}
                style={styles.bigInput}
                selectTextOnFocus
              />
              <Text style={styles.bigInputUnit}>{t("common.minute")}</Text>
            </View>
            <View style={styles.quickRow}>
              {[0, 5, 10, 15, 30, 60].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setWaitValue(String(n))}
                  style={[
                    styles.quickChip,
                    String(n) === waitValue && styles.quickChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      String(n) === waitValue && styles.quickChipTextActive,
                    ]}
                  >
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
            {status && <Text style={styles.statusText}>{status}</Text>}
            <Pressable
              onPress={submit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.submit,
                (pressed || submitting) && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.submitText}>{t("common.submit")}</Text>
            </Pressable>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  mapWrap: {
    height: 260,
    backgroundColor: theme.colors.surface2,
    position: "relative",
  },
  qmarker: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.md,
  },
  qmarkerText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  legend: {
    position: "absolute",
    bottom: 14,
    left: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
    ...theme.shadow.md,
  },
  legendTitle: {
    fontSize: 9,
    fontWeight: "800",
    color: theme.colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  legendText: {
    fontSize: 11,
    color: theme.colors.textSoft,
    fontWeight: "600",
  },
  list: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  rowSub: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  rowTime: { fontSize: 11, color: theme.colors.muted },
  waitPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  waitPillText: { fontSize: 11, fontWeight: "700" },
  reportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.text,
    borderRadius: 10,
  },
  reportBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  sheet: {
    flex: 1,
    padding: 20,
    backgroundColor: theme.colors.bg,
    gap: 18,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  sheetSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  bigInputWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  bigInput: {
    fontSize: 64,
    fontWeight: "800",
    color: theme.colors.accent,
    minWidth: 80,
    textAlign: "center",
  },
  bigInputUnit: {
    fontSize: 18,
    color: theme.colors.muted,
    fontWeight: "600",
  },
  quickRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  quickChip: {
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
  },
  quickChipActive: {
    backgroundColor: theme.colors.accent,
  },
  quickChipText: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  quickChipTextActive: { color: "#ffffff" },
  statusText: {
    textAlign: "center",
    color: theme.colors.textSoft,
    fontSize: 12,
  },
  submit: {
    marginTop: "auto",
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  submitText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
  },
});
