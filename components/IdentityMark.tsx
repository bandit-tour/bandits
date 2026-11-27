import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

/**
 * Neutral identity when no approved photograph exists.
 * Never substitutes another person, hotel, or business.
 */
export function IdentityMark({
  name,
  style,
  fill = true,
  label,
}: {
  name: string;
  style?: StyleProp<ViewStyle>;
  fill?: boolean;
  label?: string;
}) {
  const who = name.trim() || "this person";
  return (
    <View
      style={[fill ? StyleSheet.absoluteFillObject : null, styles.plate, style]}
      accessibilityLabel={label || `Photograph of ${who} is not on file`}
    >
      <Text style={styles.mark}>{initials(who)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    backgroundColor: "#23342f",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  mark: {
    color: "#f3efe6",
    fontSize: 56,
    fontWeight: "500",
    letterSpacing: 1,
  },
});
