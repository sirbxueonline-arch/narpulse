import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  Platform,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { theme, NARIMANOV_CENTER, NARIMANOV_DELTA, utilityColor } from "@/lib/theme";
import { fetchOutages, relativeMinutes, formatClock } from "@/lib/data";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import type { Outage, Utility } from "@/lib/types";
import ScreenHeader from "@/components/ScreenHeader";

type Filter = "all" | Utility;

const UTILITY_ICON: Record<Utility, keyof typeof Ionicons.glyphMap> = {
  water: "water",
  electricity: "flash",
  gas: "flame",
};

export default function OutagesScreen() {
  const { t } = useI18n();
  const [outages, setOutages] = React.useState<Outage[]>([]);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selected, setSelected] = React.useState<Outage | null>(null);
  const mapRef = React.useRef<MapView | null>(null);

  const load = React.useCallback(async () => {
    const data = await fetchOutages();
    setOutages(data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Realtime
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    const ch = supabase
      .channel("ios-outages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "outages" },
        (payload) => setOutages((prev) => [payload.new as Outage, ...prev])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "outages" },
        (payload) =>
          setOutages((prev) =>
            prev.map((o) =>
              o.id === (payload.new as Outage).id ? (payload.new as Outage) : o
            )
          )
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const visible = outages.filter((o) => {
    if (o.status === "resolved") return false;
    if (filter !== "all" && o.utility !== filter) return false;
    return true;
  });

  const activeCount = outages.filter((o) => o.status === "active").length;

  const flyTo = (o: Outage) => {
    setSelected(o);
    mapRef.current?.animateToRegion(
      {
        latitude: o.center_lat,
        longitude: o.center_lng,
        latitudeDelta: 0.012,
        longitudeDelta: 0.014,
      },
      450
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t("outages.title")}
        subtitle={t("outages.subtitle")}
        right={
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>
              {activeCount} {t("outages.active").toLowerCase()}
            </Text>
          </View>
        }
      />

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            ...NARIMANOV_CENTER,
            ...NARIMANOV_DELTA,
          }}
          showsUserLocation
          showsCompass={false}
        >
          {visible.map((o) => (
            <Marker
              key={o.id}
              coordinate={{ latitude: o.center_lat, longitude: o.center_lng }}
              onPress={() => setSelected(o)}
              tracksViewChanges={false}
            >
              <View style={styles.marker}>
                <View
                  style={[
                    styles.markerDot,
                    {
                      backgroundColor: utilityColor(o.utility),
                      borderColor:
                        o.status === "planned"
                          ? theme.colors.warning
                          : "#ffffff",
                    },
                  ]}
                />
              </View>
            </Marker>
          ))}
        </MapView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsScroll}
        >
          {(
            [
              { key: "all", label: t("outages.all"), icon: "layers" },
              { key: "water", label: t("outages.water"), icon: "water" },
              { key: "electricity", label: t("outages.electric"), icon: "flash" },
              { key: "gas", label: t("outages.gas"), icon: "flame" },
            ] as const
          ).map((c) => {
            const active = filter === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setFilter(c.key as Filter)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Ionicons
                  name={c.icon as keyof typeof Ionicons.glyphMap}
                  size={14}
                  color={active ? "#ffffff" : theme.colors.textSoft}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
        {loading && visible.length === 0 ? (
          <Text style={styles.empty}>{t("common.loading")}</Text>
        ) : visible.length === 0 ? (
          <Text style={styles.empty}>{t("outages.noActive")}</Text>
        ) : (
          visible.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => flyTo(o)}
              style={[
                styles.row,
                selected?.id === o.id && styles.rowSelected,
              ]}
            >
              <View
                style={[
                  styles.rowStripe,
                  { backgroundColor: utilityColor(o.utility) },
                ]}
              />
              <View
                style={[
                  styles.rowIcon,
                  { backgroundColor: `${utilityColor(o.utility)}1a` },
                ]}
              >
                <Ionicons
                  name={UTILITY_ICON[o.utility]}
                  size={18}
                  color={utilityColor(o.utility)}
                />
              </View>
              <View style={styles.rowBody}>
                <Text numberOfLines={1} style={styles.rowTitle}>
                  {o.area_name}
                </Text>
                <View style={styles.rowMeta}>
                  <View
                    style={[
                      styles.statusBadge,
                      o.status === "active"
                        ? styles.statusActive
                        : o.status === "planned"
                        ? styles.statusPlanned
                        : styles.statusResolved,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        o.status === "active"
                          ? styles.statusActiveText
                          : o.status === "planned"
                          ? styles.statusPlannedText
                          : styles.statusResolvedText,
                      ]}
                    >
                      {o.status === "active"
                        ? t("outages.active")
                        : o.status === "planned"
                        ? t("outages.planned")
                        : t("outages.resolved")}
                    </Text>
                  </View>
                  <Text style={styles.rowTime}>
                    {relativeMinutes(o.started_at)}
                  </Text>
                </View>
                {o.estimated_end && o.status !== "resolved" && (
                  <Text style={styles.rowEta}>
                    {t("outages.eta")} · {formatClock(o.estimated_end)}
                  </Text>
                )}
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.muted}
              />
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View
                style={[
                  styles.rowIcon,
                  {
                    backgroundColor: `${utilityColor(selected.utility)}1a`,
                    width: 44,
                    height: 44,
                  },
                ]}
              >
                <Ionicons
                  name={UTILITY_ICON[selected.utility]}
                  size={22}
                  color={utilityColor(selected.utility)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{selected.area_name}</Text>
                <Text style={styles.sheetSub}>
                  {selected.utility === "water"
                    ? t("outages.water")
                    : selected.utility === "electricity"
                    ? t("outages.electric")
                    : t("outages.gas")}
                  {" · "}
                  {relativeMinutes(selected.started_at)}
                </Text>
              </View>
              <Pressable onPress={() => setSelected(null)} hitSlop={12}>
                <Ionicons name="close" size={22} color={theme.colors.muted} />
              </Pressable>
            </View>
            {selected.description && (
              <Text style={styles.sheetDesc}>{selected.description}</Text>
            )}
            {selected.estimated_end && (
              <View style={styles.etaPill}>
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={theme.colors.text}
                />
                <Text style={styles.etaText}>
                  {t("outages.eta")} {formatClock(selected.estimated_end)}
                </Text>
              </View>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.accentSoft,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
  },
  liveText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.accent2,
  },
  mapWrap: {
    height: 280,
    backgroundColor: theme.colors.surface2,
    position: "relative",
    overflow: "hidden",
  },
  chipsScroll: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
  },
  chips: {
    paddingHorizontal: 12,
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  chipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textSoft,
  },
  chipTextActive: {
    color: "#ffffff",
  },
  marker: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  markerDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 3,
  },
  list: { flex: 1 },
  empty: {
    textAlign: "center",
    color: theme.colors.muted,
    paddingVertical: 40,
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  rowSelected: {
    backgroundColor: theme.colors.surface2,
  },
  rowStripe: {
    width: 3,
    height: 32,
    borderRadius: 2,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1 },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  rowTime: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  rowEta: {
    marginTop: 4,
    fontSize: 11,
    color: theme.colors.muted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: `${theme.colors.accent}33`,
  },
  statusPlanned: {
    backgroundColor: theme.colors.warningSoft,
    borderColor: `${theme.colors.warning}33`,
  },
  statusResolved: {
    backgroundColor: theme.colors.successSoft,
    borderColor: `${theme.colors.success}33`,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statusActiveText: { color: theme.colors.accent },
  statusPlannedText: { color: theme.colors.warning },
  statusResolvedText: { color: theme.colors.success },
  sheet: {
    flex: 1,
    padding: 20,
    backgroundColor: theme.colors.bg,
    gap: 14,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text,
  },
  sheetSub: {
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "600",
  },
  sheetDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSoft,
  },
  etaPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.surface2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  etaText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.text,
  },
});
