import React, { useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { EventGenre, getGenreIcon } from '@/constants/Genres';

/** First line: Food, Culture, Nightlife — second line: Shopping, Coffee (max two rows on all profiles). */
const CATEGORY_ROW_1: EventGenre[] = ['Food', 'Culture', 'Nightlife'];
const CATEGORY_ROW_2: EventGenre[] = ['Shopping', 'Coffee'];

interface EventCategory {
  genre: EventGenre;
  count: number;
}

interface EventCategoriesProps {
  categories: EventCategory[];
  selectedGenre?: string;
  onCategoryPress?: (genre: string) => void;
}

const CategoryChip = ({
  category,
  isSelected,
  onPress,
}: {
  category: EventCategory;
  isSelected: boolean;
  onPress: () => void;
}) => (
  <View style={styles.categoryItemTouchTarget}>
    <TouchableOpacity
      style={[styles.categoryBadge, isSelected && styles.categoryBadgeSelected]}
      onPress={onPress}
      activeOpacity={0.85}
      delayPressIn={0}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
    >
      <Text style={styles.categoryIcon}>{getGenreIcon(category.genre)}</Text>
      <Text
        style={[styles.categoryText, isSelected && styles.categoryTextSelected]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {category.count} {category.genre.toUpperCase()}
      </Text>
    </TouchableOpacity>
  </View>
);

export default function EventCategories({ categories, selectedGenre, onCategoryPress }: EventCategoriesProps) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;
  const byGenre = useMemo(() => {
    const m = new Map<EventGenre, EventCategory>();
    for (const c of categories || []) {
      m.set(c.genre, c);
    }
    return m;
  }, [categories]);

  if (!categories || categories.length === 0) {
    return null;
  }

  const renderRow = (genres: EventGenre[]) => {
    const items = genres.map((g) => byGenre.get(g)).filter((c): c is EventCategory => !!c);
    if (items.length === 0) return null;
    return (
      <View style={[styles.categoriesRow, isDesktopWeb && styles.categoriesRowDesktop]}>
        {items.map((category) => (
          <View key={category.genre} style={[styles.categoryItem, isDesktopWeb && styles.categoryItemDesktop]}>
            <CategoryChip
              category={category}
              isSelected={selectedGenre === category.genre}
              onPress={() => onCategoryPress?.(category.genre)}
            />
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, isDesktopWeb && styles.containerDesktop]} collapsable={false}>
      {renderRow(CATEGORY_ROW_1)}
      {renderRow(CATEGORY_ROW_2)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    paddingHorizontal: 4,
  },
  containerDesktop: {
    marginVertical: 20,
  },
  categoriesRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    marginBottom: 6,
  },
  categoriesRowDesktop: {
    gap: 10,
  },
  categoryItem: {
    flex: 1,
    minWidth: 0,
  },
  categoryItemDesktop: {
    maxWidth: 260,
  },
  categoryItemTouchTarget: {
    flex: 1,
    alignSelf: 'stretch',
  },
  categoryBadge: {
    backgroundColor: '#ECECEC',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 2,
    minHeight: 25,
    borderWidth: 1,
    borderColor: 'transparent',
    flex: 1,
    alignSelf: 'stretch',
  },
  categoryBadgeSelected: {
    backgroundColor: '#FFE5E5',
    borderColor: '#FF0000',
  },
  categoryIcon: {
    fontSize: 12,
    flexShrink: 0,
  },
  categoryText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#3C3C3C',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  categoryTextSelected: {
    color: '#FF0000',
  },
});
