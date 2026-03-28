import { Stack, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Database } from '@/lib/database.types';
import {
  fetchGooglePlacePhotoUrl as resolveGooglePlacePhotoUrl,
  getCategoryFallbackImage,
  isLikelyLogoOrBadPlaceImage,
  normalizeEventImageUri,
} from '@/lib/placePhoto';
import { getCuratedEventImageCandidates } from '@/lib/eventImageCuration';
import { supabase } from '@/lib/supabase';
import ReviewCard from '@/components/ReviewCard';
import { trackEvent } from '@/lib/analytics';

// For City Guide, the ID passed into /spot/[id] comes from the event card,
// so this screen should load from the event table, not spots.
type Spot = Database['public']['Tables']['event']['Row'];

type SpotReview = {
  user_id: string;
  review: string;
  rating: number;
  created_at?: string;
  user_name: string;
};

function parseGalleryImages(raw: string | null, fallback: string | null, curated: string[] = []): string[] {
  const out: string[] = [];
  const pushNorm = (u: string) => {
    const n = normalizeEventImageUri(u);
    if (n) out.push(n);
  };
  curated.forEach((u) => pushNorm(u));
  if (fallback?.trim()) pushNorm(fallback.trim());
  if (!raw) {
    const unique = Array.from(new Set(out));
    return unique.filter((u) => !isLikelyLogoOrBadPlaceImage(u)).slice(0, 5);
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((v) => {
        if (typeof v === 'string' && v.trim()) pushNorm(v.trim());
      });
    }
  } catch {
    raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .forEach((v) => pushNorm(v));
  }

  const unique = Array.from(new Set(out));
  const sanitized = unique.filter((u) => !isLikelyLogoOrBadPlaceImage(u));
  return sanitized.slice(0, 5);
}

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<SpotReview[]>([]);
  const [visibleGallery, setVisibleGallery] = useState<string[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  useEffect(() => {
    const fetchSpot = async () => {
      if (!id) return;
      try {
        setLoading(true);
        console.log('[SpotDetail] spotId from route:', id);
        const { data, error: err } = await supabase
          .from('event')
          .select('*')
          .eq('id', id as string)
          .single();

        console.log('[SpotDetail] query result:', data, 'error:', err);

        if (err) throw err;
        setSpot(data);
        void trackEvent({
          eventName: 'spot_opened',
          referenceType: 'spot',
          referenceId: String(data.id),
          onceKey: `spot_opened:${data.id}`,
        });
        setGalleryLoading(false);
        const curated = getCuratedEventImageCandidates(data as any);
        const parsedGallery = parseGalleryImages(data.image_gallery, data.image_url, curated);
        setVisibleGallery(parsedGallery);

        // If stored images are missing/invalid, optionally resolve via Google Places (spinner only during this fetch).
        if (parsedGallery.length === 0) {
          setGalleryLoading(true);
          try {
            const photoUrl = await resolveGooglePlacePhotoUrl({
              placeId: (data as any).google_place_id ?? null,
              name: String(data.name ?? ''),
              address: String(data.address ?? ''),
              city: String(data.city ?? ''),
              neighborhood: String(data.neighborhood ?? ''),
            });
            if (photoUrl) {
              setVisibleGallery([normalizeEventImageUri(photoUrl) ?? photoUrl]);
            }
          } catch (e) {
            console.warn('[SpotDetail] google photo fetch failed', { spotId: id, e });
          } finally {
            setGalleryLoading(false);
          }
        }
        // Reviews for spots are not implemented yet; keep empty state (no fake data).
        setReviews([]);
      } catch (err) {
        console.error('[SpotDetail] failed to load event for spot screen:', err);
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.galleryRow}
        >
          {visibleGallery.length > 0 ? (
            visibleGallery.map((uri, index) => (
              <Image
                key={`${uri}-${index}`}
                source={{ uri }}
                style={styles.image}
                resizeMode="cover"
                onError={() =>
                  setVisibleGallery((prev) => prev.filter((u) => u !== uri))
                }
              />
            ))
          ) : galleryLoading ? (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="small" />
            </View>
          ) : (
            <Image
              source={{
                uri: getCategoryFallbackImage(
                  spot.genre,
                  `spot-detail-${spot.id}`,
                  900,
                  600,
                ),
              }}
              style={styles.image}
              resizeMode="cover"
            />
          )}
        </ScrollView>
        <Text style={styles.name}>{spot.name}</Text>
        <Text style={styles.category}>{spot.genre}</Text>
        {spot.city && <Text style={styles.city}>{spot.city}</Text>}
        {!!spot.address && (
          <TouchableOpacity
            onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.address)}`)}
          >
            <Text style={styles.addressLabel}>Address</Text>
            <Text style={styles.addressValue}>{spot.address}</Text>
          </TouchableOpacity>
        )}
        {spot.description && (
          <>
            <Text style={styles.description}>{spot.description}</Text>
          </>
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
  image: {
    width: 280,
    height: 160,
    borderRadius: 12,
    marginRight: 10,
  },
  imageLoadingOverlay: {
    width: 280,
    height: 160,
    borderRadius: 12,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholder: {
    backgroundColor: '#E8E8E8',
  },
  galleryRow: { paddingBottom: 16 },
  name: { fontSize: 22, fontWeight: '700', color: '#222', marginBottom: 8 },
  category: { fontSize: 14, color: '#666', marginBottom: 4 },
  city: { fontSize: 14, color: '#555', marginBottom: 12 },
  addressLabel: { fontSize: 13, fontWeight: '700', color: '#222', marginBottom: 2 },
  addressValue: { fontSize: 14, color: '#0A63C9', marginBottom: 12, lineHeight: 20 },
  description: { fontSize: 14, color: '#3C3C3C', lineHeight: 20, marginBottom: 6 },
  vibePunchline: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  vibeText: {
    fontSize: 12,
    color: '#4A4A4A',
    lineHeight: 18,
    marginBottom: 10,
  },
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
