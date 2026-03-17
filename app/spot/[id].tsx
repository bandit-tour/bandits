import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import ReviewCard from '@/components/ReviewCard';

type Spot = Database['public']['Tables']['spots']['Row'];

type SpotReview = {
  user_id: string;
  review: string;
  rating: number;
  created_at?: string;
  user_name: string;
};

const SAMPLE_SPOT_REVIEWS: SpotReview[] = [
  {
    user_id: 'spot-1',
    user_name: 'late_night_local',
    review: 'Crowd was mixed, playlist was on point, zero tourist energy.',
    rating: 5,
  },
  {
    user_id: 'spot-2',
    user_name: 'corner_table_only',
    review: 'Feels like a friend-of-a-friend tip, not a Google list.',
    rating: 4,
  },
  {
    user_id: 'spot-3',
    user_name: 'noisy_but_worth_it',
    review: 'Went for “one drink” and left three hours later.',
    rating: 5,
  },
];

const DEFAULT_IMAGE =
  'https://zubcakeamyfqatdmleqx.supabase.co/storage/v1/object/public/banditsassets4/assets/jazzInjazz.png';

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<SpotReview[]>([]);

  useEffect(() => {
    const fetchSpot = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const { data, error: err } = await supabase
          .from('spots')
          .select('*')
          .eq('id', id as string)
          .single();

        if (err) throw err;
        setSpot(data);

        // For now, use underground-style sample reviews for every spot
        setReviews(SAMPLE_SPOT_REVIEWS.slice(0, 5));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load spot');
      } finally {
        setLoading(false);
      }
    };

    fetchSpot();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !spot) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Spot not found'}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Image
          source={{ uri: DEFAULT_IMAGE }}
          style={styles.image}
          resizeMode="cover"
        />
        <Text style={styles.name}>{spot.name}</Text>
        <Text style={styles.category}>{spot.category}</Text>
        {spot.city && <Text style={styles.city}>{spot.city}</Text>}
        {spot.description && (
          <Text style={styles.description}>{spot.description}</Text>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <View style={styles.reviewsSection}>
            <Text style={styles.reviewsTitle}>
              Reviews <Text style={styles.reviewsCount}>({reviews.length})</Text>
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reviewsContainer}
            >
              {reviews.slice(0, 5).map((review, index) => (
                <ReviewCard key={index} review={review} />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#FF3B30' },
  image: { width: '100%', height: 200, borderRadius: 12, marginBottom: 16 },
  name: { fontSize: 22, fontWeight: '700', color: '#222', marginBottom: 8 },
  category: { fontSize: 14, color: '#666', marginBottom: 4 },
  city: { fontSize: 14, color: '#555', marginBottom: 12 },
  description: { fontSize: 14, color: '#3C3C3C', lineHeight: 20 },
  reviewsSection: {
    marginTop: 20,
  },
  reviewsTitle: {
    fontFamily: 'Caros',
    fontWeight: '800',
    fontSize: 20,
    color: '#3C3C3C',
    marginBottom: 12,
  },
  reviewsCount: {
    fontFamily: 'Caros',
    fontWeight: '400',
    fontSize: 14,
    color: '#FFB800',
  },
  reviewsContainer: {
    paddingHorizontal: 8,
  },
});
