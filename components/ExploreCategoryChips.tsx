import React, { useCallback } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  EXPLORE_CATEGORY_CHIPS,
  type ExploreCategoryChip,
} from '@/lib/exploreCategoryFilter';

type Props = {
  selected: ExploreCategoryChip;
  onSelect: (chip: ExploreCategoryChip) => void;
};

function ExploreCategoryChipsInner({ selected, onSelect }: Props) {
  const handleSelect = useCallback(
    (chip: ExploreCategoryChip) => {
      if (chip === selected) return;
      onSelect(chip);
    },
    [onSelect, selected],
  );

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
              onPress={() => handleSelect(chip)}
              delayPressIn={0}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
              android_ripple={{ color: 'rgba(10, 126, 164, 0.18)', borderless: false }}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && !active && styles.chipPressed,
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
    backgroundColor: '#181818',
    borderColor: '#181818',
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

export default React.memo(ExploreCategoryChipsInner);
