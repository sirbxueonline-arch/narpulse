import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import ScreenHeader from "@/components/ScreenHeader";
import Logo from "@/components/Logo";

type AuthStep = "email" | "code";

export default function AccountScreen() {
  const { t } = useI18n();
  const { user, profile, signOut, ready } = useAuth();
  const [step, setStep] = React.useState<AuthStep>("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!ready) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t("tabs.account")} />
        <Text style={styles.loading}>{t("common.loading")}</Text>
      </View>
    );
  }

  if (user) {
    const initial = (user.email?.[0] ?? "?").toUpperCase();
    return (
      <View style={styles.root}>
        <ScreenHeader title={t("tabs.account")} />
        <ScrollView contentContainerStyle={styles.userWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </View>
          <Text style={styles.userEmail}>{user.email}</Text>
          {profile?.role === "admin" ? (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={12} color={theme.colors.accent} />
              <Text style={styles.adminText}>{t("auth.admin")}</Text>
            </View>
          ) : (
            <View style={styles.residentBadge}>
              <Ionicons name="person" size={12} color={theme.colors.muted} />
              <Text style={styles.residentText}>Resident</Text>
            </View>
          )}
          <Pressable
            onPress={() => {
              Alert.alert(t("auth.signOut"), undefined, [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("auth.signOut"),
                  style: "destructive",
                  onPress: signOut,
                },
              ]);
            }}
            style={styles.signOutBtn}
          >
            <Ionicons name="log-out-outline" size={16} color={theme.colors.text} />
            <Text style={styles.signOutText}>{t("auth.signOut")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const sendCode = async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Supabase not configured. Add EXPO_PUBLIC_SUPABASE_URL/_KEY.");
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(trimmed)) {
      setError("Enter a valid email.");
      return;
    }
    setSending(true);
    const { error: err } = await getSupabase().auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });
    setSending(false);
    if (err) {
      setError(err.message);
    } else {
      setStep("code");
    }
  };

  const verify = async () => {
    setError(null);
    if (code.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    const { error: err } = await getSupabase().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    setVerifying(false);
    if (err) {
      setError(err.message);
    } else {
      setStep("email");
      setEmail("");
      setCode("");
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t("tabs.account")} />
      <ScrollView contentContainerStyle={styles.formWrap}>
        <View style={styles.logoWrap}>
          <Logo size={36} />
        </View>
        <Text style={styles.title}>{t("auth.title")}</Text>
        <Text style={styles.sub}>{t("auth.subtitle")}</Text>

        {step === "email" ? (
          <>
            <Text style={styles.label}>{t("auth.email")}</Text>
            <View style={styles.inputRow}>
              <Ionicons
                name="mail-outline"
                size={16}
                color={theme.colors.muted}
                style={styles.inputIcon}
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t("auth.emailPlaceholder")}
                placeholderTextColor={theme.colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                autoComplete="email"
              />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Pressable
              onPress={sendCode}
              disabled={sending}
              style={({ pressed }) => [
                styles.primaryBtn,
                (pressed || sending) && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.primaryBtnText}>{t("auth.send")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.sentNotice}>
              {t("auth.sent")} · {email}
            </Text>
            <Text style={styles.label}>{t("auth.codeLabel")}</Text>
            <View style={styles.inputRow}>
              <Ionicons
                name="key-outline"
                size={16}
                color={theme.colors.muted}
                style={styles.inputIcon}
              />
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ""))}
                placeholder="123456"
                placeholderTextColor={theme.colors.muted}
                keyboardType="number-pad"
                maxLength={6}
                style={[styles.input, { letterSpacing: 6, fontWeight: "700" }]}
              />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Pressable
              onPress={verify}
              disabled={verifying}
              style={({ pressed }) => [
                styles.primaryBtn,
                (pressed || verifying) && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.primaryBtnText}>{t("auth.verify")}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>{t("auth.tryAgain")}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  loading: {
    textAlign: "center",
    paddingTop: 60,
    color: theme.colors.muted,
  },
  userWrap: {
    padding: 28,
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  avatarLetter: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "800",
  },
  userEmail: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 4,
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}44`,
  },
  adminText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.accent,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  residentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  residentText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  signOutBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
  },
  signOutText: { fontWeight: "700", color: theme.colors.text },
  formWrap: {
    padding: 24,
    gap: 14,
  },
  logoWrap: { alignItems: "center", marginBottom: 4 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
  },
  sub: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}33`,
  },
  primaryBtn: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
  sentNotice: {
    fontSize: 12,
    color: theme.colors.success,
    backgroundColor: theme.colors.successSoft,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${theme.colors.success}33`,
    textAlign: "center",
  },
  linkBtn: { alignItems: "center", paddingVertical: 8 },
  linkText: {
    color: theme.colors.muted,
    fontWeight: "600",
    fontSize: 13,
  },
});
