import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/lib/i18n";
import { theme } from "@/lib/theme";
import Logo from "./Logo";

type Props = {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export default function ScreenHeader({ title, subtitle, right }: Props) {
  const insets = useSafeAreaInsets();
  const { locale, setLocale } = useI18n();
  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top + 6 },
      ]}
    >
      <View style={styles.top}>
        <Logo size={24} />
        <View style={styles.topRight}>
          <Pressable
            onPress={() => setLocale(locale === "az" ? "en" : "az")}
            style={styles.locale}
            hitSlop={8}
          >
            <Text
              style={[
                styles.localeText,
                locale === "az" && styles.localeActive,
              ]}
            >
              AZ
            </Text>
            <Text style={styles.localeSep}>·</Text>
            <Text
              style={[
                styles.localeText,
                locale === "en" && styles.localeActive,
              ]}
            >
              EN
            </Text>
          </Pressable>
          {right}
        </View>
      </View>
      {(title || subtitle) && (
        <View style={styles.titles}>
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.bg,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  locale: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  localeText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.muted,
    letterSpacing: 1,
  },
  localeActive: {
    color: theme.colors.text,
  },
  localeSep: {
    fontSize: 10,
    color: theme.colors.border,
  },
  titles: {
    marginTop: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: theme.colors.muted,
  },
});
