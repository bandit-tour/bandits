import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  EXPLORE_CATEGORY_CHIPS,
  type ExploreCategoryChip,
} from '@/lib/exploreCategoryFilter';

type Props = {
  selected: ExploreCategoryChip;
  onSelect: (chip: ExploreCategoryChip) => void;
};

export default function ExploreCategoryChips({ selected, onSelect }: Props) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {EXPLORE_CATEGORY_CHIPS.map((chip) => {
          const active = chip === selected;
          return (
            <Pressable
              key={chip}
              onPress={() => onSelect(chip)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter by ${chip}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                {chip}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
  },
  row: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8D8D8',
    backgroundColor: '#F7F7F7',
  },
  chipActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
