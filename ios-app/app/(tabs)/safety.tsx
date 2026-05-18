import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Image,
  Platform,
  Alert,
} from "react-native";
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  type LatLng,
} from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { theme, NARIMANOV_CENTER, NARIMANOV_DELTA } from "@/lib/theme";
import { fetchPins, relativeMinutes } from "@/lib/data";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import ScreenHeader from "@/components/ScreenHeader";
import type { SafetyCategory, SafetyPin } from "@/lib/types";

const CATS: SafetyCategory[] = [
  "crossing",
  "lighting",
  "traffic",
  "sidewalk",
  "other",
];

const CAT_ICON: Record<SafetyCategory, keyof typeof Ionicons.glyphMap> = {
  crossing: "walk",
  lighting: "bulb",
  traffic: "car",
  sidewalk: "trail-sign",
  other: "alert-circle",
};

export default function SafetyScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [pins, setPins] = React.useState<SafetyPin[]>([]);
  const [dropMode, setDropMode] = React.useState(false);
  const [dropCoords, setDropCoords] = React.useState<LatLng | null>(null);
  const [category, setCategory] = React.useState<SafetyCategory>("crossing");
  const [description, setDescription] = React.useState("");
  const [photo, setPhoto] = React.useState<ImagePicker.ImagePickerAsset | null>(
    null
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [voted, setVoted] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<SafetyPin | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchPins().then(setPins);
  }, []);

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    const ch = supabase
      .channel("ios-pins")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "safety_pins" },
        (p) => setPins((prev) => [p.new as SafetyPin, ...prev])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "safety_pins" },
        (p) =>
          setPins((prev) =>
            prev.map((x) =>
              x.id === (p.new as SafetyPin).id ? (p.new as SafetyPin) : x
            )
          )
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const onMapPress = (e: { nativeEvent: { coordinate: LatLng } }) => {
    if (!dropMode) return;
    setDropCoords(e.nativeEvent.coordinate);
  };

  const cancelDrop = () => {
    setDropMode(false);
    setDropCoords(null);
    setDescription("");
    setPhoto(null);
    setStatus(null);
  };

  const pickImage = async () => {
    const { status: permStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== "granted") {
      Alert.alert("Permission required", "Photo library access is needed.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: false,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  };

  const submit = async () => {
    if (!dropCoords) return;
    if (!user) {
      setStatus(t("common.loginRequired"));
      return;
    }
    setSubmitting(true);
    let photo_url: string | null = null;
    const supabase = getSupabase();
    if (photo) {
      try {
        const ext = photo.uri.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const res = await fetch(photo.uri);
        const blob = await res.blob();
        const { error: upErr } = await supabase.storage
          .from("safety-photos")
          .upload(path, blob, {
            contentType: photo.mimeType ?? `image/${ext}`,
          });
        if (!upErr) {
          const { data } = supabase.storage
            .from("safety-photos")
            .getPublicUrl(path);
          photo_url = data.publicUrl;
        }
      } catch {
        // ignore upload errors; still submit pin
      }
    }
    const { error } = await supabase.from("safety_pins").insert({
      lat: dropCoords.latitude,
      lng: dropCoords.longitude,
      category,
      description: description.trim() || null,
      photo_url,
      user_id: user.id,
    });
    setSubmitting(false);
    if (error) {
      setStatus(error.message);
    } else {
      setStatus(t("safety.saved"));
      setTimeout(cancelDrop, 800);
    }
  };

  const upvote = async (id: string) => {
    if (voted.has(id)) return;
    setPins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, upvotes: p.upvotes + 1 } : p))
    );
    setVoted((s) => new Set(s).add(id));
    if (!user || !isSupabaseConfigured) return;
    await getSupabase().from("pin_votes").insert({
      pin_id: id,
      user_id: user.id,
    });
  };

  const catLabel = (c: SafetyCategory) => t(`safety.${c}`);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t("safety.title")}
        subtitle={t("safety.subtitle")}
        right={
          dropMode ? (
            <Pressable onPress={cancelDrop} style={styles.cancelBtn}>
              <Ionicons name="close" size={14} color={theme.colors.accent} />
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setDropMode(true)} style={styles.addBtn}>
              <Ionicons name="add" size={16} color="#ffffff" />
              <Text style={styles.addText}>{t("common.addPin")}</Text>
            </Pressable>
          )
        }
      />

      <View style={styles.mapWrap}>
        <MapView
          provider={PROVIDER_DEFAULT}
          mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
          style={StyleSheet.absoluteFill}
          initialRegion={{ ...NARIMANOV_CENTER, ...NARIMANOV_DELTA }}
          showsUserLocation
          onPress={onMapPress}
        >
          {pins.map((p) => (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              onPress={() => setSelected(p)}
              tracksViewChanges={false}
            >
              <View style={styles.pinMarker}>
                <Ionicons name="warning" size={14} color="#ffffff" />
              </View>
            </Marker>
          ))}
          {dropCoords && (
            <Marker
              coordinate={dropCoords}
              tracksViewChanges={false}
              pinColor={theme.colors.accent}
            />
          )}
        </MapView>

        {dropMode && !dropCoords && (
          <View style={styles.hint}>
            <Ionicons name="location" size={14} color={theme.colors.accent} />
            <Text style={styles.hintText}>{t("safety.tapMap")}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {pins
          .slice()
          .sort((a, b) => b.upvotes - a.upvotes)
          .map((p) => (
            <Pressable
              key={p.id}
              style={styles.row}
              onPress={() => setSelected(p)}
            >
              <View style={styles.pRowIcon}>
                <Ionicons
                  name={CAT_ICON[p.category]}
                  size={18}
                  color={theme.colors.accent2}
                />
              </View>
              <View style={styles.rowBody}>
                <Text numberOfLines={2} style={styles.rowDesc}>
                  {p.description ?? catLabel(p.category)}
                </Text>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowSmall}>{catLabel(p.category)}</Text>
                  <Text style={styles.rowSmall}>·</Text>
                  <Ionicons name="thumbs-up" size={11} color={theme.colors.muted} />
                  <Text style={styles.rowSmall}>{p.upvotes}</Text>
                  <Text style={styles.rowSmall}>·</Text>
                  <Text style={styles.rowSmall}>
                    {relativeMinutes(p.created_at)}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
      </ScrollView>

      {/* New-pin sheet */}
      <Modal
        visible={dropMode && !!dropCoords}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={cancelDrop}
      >
        <ScrollView style={styles.sheet} contentContainerStyle={{ gap: 18 }}>
          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{t("safety.newPin")}</Text>
              <Text style={styles.sheetSub}>
                {dropCoords?.latitude.toFixed(4)},{" "}
                {dropCoords?.longitude.toFixed(4)}
              </Text>
            </View>
            <Pressable onPress={cancelDrop} hitSlop={12}>
              <Ionicons name="close" size={22} color={theme.colors.muted} />
            </Pressable>
          </View>

          <View>
            <Text style={styles.label}>{t("safety.category")}</Text>
            <View style={styles.catRow}>
              {CATS.map((c) => {
                const active = category === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[styles.catBtn, active && styles.catBtnActive]}
                  >
                    <Ionicons
                      name={CAT_ICON[c]}
                      size={20}
                      color={active ? theme.colors.accent : theme.colors.muted}
                    />
                    <Text
                      style={[
                        styles.catLabel,
                        active && { color: theme.colors.accent },
                      ]}
                    >
                      {catLabel(c)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.label}>{t("safety.description")}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t("safety.descPlaceholder")}
              placeholderTextColor={theme.colors.muted}
              multiline
              numberOfLines={4}
              style={styles.textarea}
            />
          </View>

          <View>
            <Text style={styles.label}>{t("safety.photo")}</Text>
            <Pressable style={styles.photoBtn} onPress={pickImage}>
              {photo ? (
                <Image source={{ uri: photo.uri }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons
                    name="image-outline"
                    size={22}
                    color={theme.colors.muted}
                  />
                  <Text style={styles.photoText}>{t("safety.pickPhoto")}</Text>
                </View>
              )}
            </Pressable>
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
        </ScrollView>
      </Modal>

      {/* Pin detail */}
      <Modal
        visible={!!selected && !dropMode}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <ScrollView style={styles.sheet} contentContainerStyle={{ gap: 16 }}>
            <View style={styles.sheetHead}>
              <View style={styles.pinIconLg}>
                <Ionicons
                  name={CAT_ICON[selected.category]}
                  size={24}
                  color={theme.colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>
                  {catLabel(selected.category)}
                </Text>
                <Text style={styles.sheetSub}>
                  {relativeMinutes(selected.created_at)}
                </Text>
              </View>
              <Pressable onPress={() => setSelected(null)} hitSlop={12}>
                <Ionicons name="close" size={22} color={theme.colors.muted} />
              </Pressable>
            </View>
            {selected.description && (
              <Text style={styles.detailDesc}>{selected.description}</Text>
            )}
            {selected.photo_url && (
              <Image
                source={{ uri: selected.photo_url }}
                style={styles.detailPhoto}
              />
            )}
            <Pressable
              onPress={() => upvote(selected.id)}
              disabled={voted.has(selected.id)}
              style={[
                styles.upvoteBtn,
                voted.has(selected.id) && { opacity: 0.6 },
              ]}
            >
              <Ionicons name="thumbs-up" size={15} color="#ffffff" />
              <Text style={styles.upvoteText}>
                {voted.has(selected.id)
                  ? `${t("safety.voted")} · ${selected.upvotes} ${t("safety.votes")}`
                  : `${t("safety.upvote")} · ${selected.upvotes} ${t("safety.votes")}`}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  addText: { color: "#ffffff", fontWeight: "700", fontSize: 12 },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}55`,
  },
  cancelText: { color: theme.colors.accent, fontWeight: "700", fontSize: 12 },
  mapWrap: {
    height: 260,
    backgroundColor: theme.colors.surface2,
    position: "relative",
  },
  pinMarker: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
    borderWidth: 2.5,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.md,
  },
  hint: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}55`,
    ...theme.shadow.md,
  },
  hintText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.text,
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
  pRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1 },
  rowDesc: {
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  rowSmall: { fontSize: 11, color: theme.colors.muted },
  sheet: { flex: 1, padding: 20, backgroundColor: theme.colors.bg },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pinIconLg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  sheetSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  label: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  catRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  catBtn: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flex: 1,
    minWidth: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
  },
  catBtnActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  catLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.textSoft,
    textAlign: "center",
  },
  textarea: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text,
    textAlignVertical: "top",
  },
  photoBtn: {
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.colors.surface2,
  },
  photoText: { color: theme.colors.muted, fontSize: 12, fontWeight: "600" },
  photo: { width: "100%", height: "100%" },
  statusText: {
    textAlign: "center",
    color: theme.colors.textSoft,
    fontSize: 12,
  },
  submit: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },
  submitText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
  },
  detailDesc: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSoft,
  },
  detailPhoto: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: theme.colors.surface2,
  },
  upvoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    borderRadius: 14,
  },
  upvoteText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
});
