import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  // getBandits,
  // ↑ Earlier method WITHOUT vibes/tags.
  // Kept commented intentionally for reference / rollback.
  getBanditsWithTags, // ✅ Correct method: fetches bandits + bandit_tags + tags
  getUniqueCities,
  toggleBanditLike,
  getUserLikedBanditIds,
} from '@/app/services/bandits';

import { getBanditEventCategories } from '@/app/services/events';
import BanditHeader from '@/components/BanditHeader';
import VibeFilterModal from '@/components/VibeFilterModal';
import { TAG_EMOJI_MAP } from '@/constants/tagNameToEmoji';
import { useCity } from '@/contexts/CityContext';
import { Database } from '@/lib/database.types';
type Bandit = Database['public']['Tables']['bandit']['Row'];

interface EventCategory {
  genre: 'Food' | 'Culture' | 'Nightlife' | 'Shopping' | 'Coffee';
  count: number;
}

/* ---------------- TAG CONFIG ---------------- */
/**
 * Vibes = how the bandit feels / their angle
 * Categories = what the bandit recommends
 * These are intentionally separated layers.
 */

const ALL_TAGS = Object.keys(TAG_EMOJI_MAP);

/* ---------------- SCREEN ---------------- */

export default function BanditsScreen() {
  const router = useRouter();
  const { selectedCity, setSelectedCity } = useCity();

  const [bandits, setBandits] = useState<any[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [banditCategories, setBanditCategories] = useState<
    Record<string, EventCategory[]>
  >({});

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  /* ---------------- INITIAL LOAD ---------------- */

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [banditsData, citiesData, likedBanditIds] = await Promise.all([
        // IMPORTANT:
        // Using getBanditsWithTags so bandit_tags are available
        // for:
        // 1. Rendering vibe chips on cards
        // 2. Client-side vibe filtering
        getBanditsWithTags(),
        getUniqueCities(),
        getUserLikedBanditIds(),
      ]);

      const banditsWithUserLikes = banditsData.map((bandit: any) => ({
        ...bandit,
        is_liked: likedBanditIds.has(bandit.id),
      }));

      setBandits(banditsWithUserLikes);
      setCities(citiesData);

      // Auto-select city if only one exists
      if (citiesData.length === 1) {
        setSelectedCity(citiesData[0]);
      }

      // Fetch event categories per bandit
      const categoriesPromises = banditsData.map(async (bandit) => {
        try {
          const categoriesData = await getBanditEventCategories(bandit.id);
          return { banditId: bandit.id, categories: categoriesData };
        } catch {
          return { banditId: bandit.id, categories: [] };
        }
      });

      const allCategoriesData = await Promise.all(categoriesPromises);

      const categoriesMap = allCategoriesData.reduce((acc, item) => {
        acc[item.banditId] = item.categories;
        return acc;
      }, {} as Record<string, EventCategory[]>);

      setBanditCategories(categoriesMap);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- FILTER LOGIC ---------------- */
  /**
   * Filters are purely client-side for the pilot.
   * Combined logic:
   * - City
   * - Search text
   * - Vibe tags
   */

  const filteredBandits = useMemo(() => {
    return bandits.filter((bandit) => {
      const matchesCity =
        !selectedCity || bandit.city === selectedCity;

      const matchesSearch =
        !searchTerm ||
        bandit.name.toLowerCase().includes(searchTerm.toLowerCase());

      const banditTagNames =
        bandit.bandit_tags?.map((bt: any) => bt.tags?.name) || [];

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => banditTagNames.includes(tag));

      return matchesCity && matchesSearch && matchesTags;
    });
  }, [bandits, selectedCity, searchTerm, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  };

  const handleLike = async (id: string, currentLikeStatus: boolean) => {
    await toggleBanditLike(id, currentLikeStatus);
    setBandits((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, is_liked: !currentLikeStatus } : b
      )
    );
  };

  /* ---------------- UI ---------------- */

  return (
    <View style={styles.mainContainer}>
      {/* SEARCH + FILTER ROW */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search bandits..."
          value={searchTerm}
          onChangeText={setSearchTerm}
        />

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setFilterOpen(true)}
        >
          <Text style={styles.filterText}>Filter</Text>

          {selectedTags.length > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>
                {selectedTags.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* BANDIT LIST */}
      <ScrollView>
        <View style={styles.container}>
          {filteredBandits.map((bandit) => (
            <BanditHeader
              key={bandit.id}
              bandit={bandit}
              categories={banditCategories[bandit.id] || []}
              variant="list"
              showActionButtons
              onLike={() =>
                handleLike(bandit.id, bandit.is_liked)
              }
              onCategoryPress={(genre) =>
                router.push(
                  `/cityGuide?banditId=${bandit.id}&genre=${genre}`
                )
              }
            />
          ))}
        </View>
      </ScrollView>

      {/* VIBE FILTER MODAL */}
      <VibeFilterModal
        visible={filterOpen}
        tags={ALL_TAGS}
        selectedTags={selectedTags}
        tagEmojiMap={TAG_EMOJI_MAP}
        onToggleTag={toggleTag}
        onClear={() => setSelectedTags([])}
        onClose={() => setFilterOpen(false)}
        onApply={() => setFilterOpen(false)}
      />
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    gap: 8,
  },

  // Restored bordered search input (no elevation)
  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  filterButton: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  filterText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFB800',
    borderRadius: 10,
    paddingHorizontal: 6,
  },

  filterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  container: {
    paddingHorizontal: 16,
    paddingBottom: 60,
    gap: 11,
  },
});
