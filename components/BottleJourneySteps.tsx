import React from "react";
import { StyleSheet, Text, View } from "react-native";

const STEPS = ["Choose Hotel", "Choose Second Sleep", "Review Journey", "Book Stay"] as const;

export function BottleJourneySteps({ active }: { active: 1 | 2 | 3 | 4 }) {
  return (
    <View style={styles.row} testID="bottle-journey-steps">
      {STEPS.map((label, index) => {
        const on = index + 1 === active;
        return (
          <Text key={label} style={[styles.step, on && styles.stepOn]}>
            {label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  step: { fontSize: 12, color: "#8A7A66" },
  stepOn: { color: "#1A1510", fontWeight: "700" },
});
