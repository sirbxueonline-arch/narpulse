import React from "react";
import { View, Text } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
} from "react-native-svg";
import { theme } from "@/lib/theme";

type Props = { size?: number; showWordmark?: boolean };

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <LinearGradient id="np-grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#E63950" />
          <Stop offset="100%" stopColor="#C8102E" />
        </LinearGradient>
      </Defs>
      <Path
        d="M20 4c-1.4 0-2.2.8-2.6 1.6-.5 1-.6 2.1-.5 3.1-3.5.7-6.6 2.6-8.4 5.5-2 3.3-2.4 7.6-.8 11.6 1.5 3.9 4.7 7.4 8.7 9.4 1.1.5 2.3.8 3.6.8s2.5-.3 3.6-.8c4-2 7.2-5.5 8.7-9.4 1.6-4 1.2-8.3-.8-11.6-1.8-2.9-4.9-4.8-8.4-5.5.1-1 0-2.1-.5-3.1C22.2 4.8 21.4 4 20 4Z"
        fill="url(#np-grad)"
      />
      <Path
        d="M19 4c-.4.7-.6 1.6-.5 2.5h3c.1-.9-.1-1.8-.5-2.5h-2Z"
        fill="#7A0A1C"
      />
      <Path
        d="m5 22 6 0 2.5-5 3 9 3.5-7 2.5 4 12.5 0"
        stroke="#F5F5F0"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export default function Logo({ size = 28, showWordmark = true }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <LogoMark size={size} />
      {showWordmark && (
        <Text
          style={{
            fontSize: size * 0.6,
            fontWeight: "800",
            color: theme.colors.text,
            letterSpacing: -0.3,
          }}
        >
          Nar<Text style={{ color: theme.colors.accent }}>Pulse</Text>
        </Text>
      )}
    </View>
  );
}
