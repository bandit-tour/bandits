import { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

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

const AnimatedCategoryItem = ({ category, isSelected, onPress }: {
  category: EventCategory;
  isSelected: boolean;
  onPress: () => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.7,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        opacity: opacityAnim,
      }}
    >
      <Pressable
        style={[
          styles.categoryBadge,
          isSelected && styles.categoryBadgeSelected,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
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
      </Pressable>
    </Animated.View>
  );
};

export default function EventCategories({ categories, selectedGenre, onCategoryPress }: EventCategoriesProps) {
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
      <View style={styles.categoriesRow}>
        {items.map((category) => (
          <View key={category.genre} style={styles.categoryItem}>
            <AnimatedCategoryItem
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
    <View style={styles.container}>
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
  categoriesRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    marginBottom: 6,
  },
  categoryItem: {
    flex: 1,
    minWidth: 0,
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