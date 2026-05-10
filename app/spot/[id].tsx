import { Stack, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { isEventLiked, toggleEventLike } from '@/app/services/events';
import { Database } from '@/lib/database.types';
import {
  fetchGooglePlacePhotoUrl as resolveGooglePlacePhotoUrl,
  isGooglePlacesDerivedPhotoUrl,
  isLikelyLogoOrBadPlaceImage,
  normalizeEventImageUri,
} from '@/lib/placePhoto';
import { buildNeutralBusinessPlaceholderFromSeed } from '@/lib/recommendationImages';
import { getCuratedEventImageCandidates } from '@/lib/eventImageCuration';
import { supabase } from '@/lib/supabase';
import ReviewCard from '@/components/ReviewCard';
import { VenueScamWarningsSection } from '@/components/VenueScamWarningsSection';
import { trackEvent } from '@/lib/analytics';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { repairDisplayText } from '@/lib/repairTextEncoding';

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
    return unique
      .filter((u) => !isLikelyLogoOrBadPlaceImage(u) && isGooglePlacesDerivedPhotoUrl(u))
      .slice(0, 5);
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
  const sanitized = unique.filter((u) => !isLikelyLogoOrBadPlaceImage(u) && isGooglePlacesDerivedPhotoUrl(u));
  return sanitized.slice(0, 5);
}

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
  const [spot, setSpot] = useState<Spot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<SpotReview[]>([]);
  const [visibleGallery, setVisibleGallery] = useState<string[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadSpot = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!id) return;
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
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
            const norm = photoUrl ? normalizeEventImageUri(photoUrl) ?? photoUrl : null;
            if (norm && isGooglePlacesDerivedPhotoUrl(norm)) {
              setVisibleGallery([norm]);
            } else {
              setVisibleGallery([]);
            }
          } catch (e) {
            console.warn('[SpotDetail] google photo fetch failed', { spotId: id, e });
            setVisibleGallery([]);
          } finally {
            setGalleryLoading(false);
          }
        }
        setReviews([]);
        setError(null);
      } catch (err) {
        console.error('[SpotDetail] failed to load event for spot screen:', err);
        setError(err instanceof Error ? err.message : 'Failed to load spot');
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void loadSpot();
  }, [loadSpot]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const v = await isEventLiked(String(id));
        if (!cancelled) setLiked(v);
      } catch {
        if (!cancelled) setLiked(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const onRefreshSpot = useCallback(() => {
    void loadSpot({ silent: true });
  }, [loadSpot]);
  const spotDetailRefresh = usePremiumRefreshControl(refreshing, onRefreshSpot);

  const onToggleLike = useCallback(async () => {
    if (!spot) return;
    try {
      await toggleEventLike(spot.id, liked);
      setLiked((prev) => !prev);
    } catch {
      Alert.alert('Unable to save', 'Finish setup in Profile, then try saving this spot again.');
    }
  }, [spot, liked]);

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
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, isDesktopWeb && styles.contentDesktop]}
        refreshControl={spotDetailRefresh}
      >
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
                uri: buildNeutralBusinessPlaceholderFromSeed(
                  String(spot.name ?? ''),
                  `spot-detail-${spot.id}`,
                ),
              }}
              style={styles.image}
              resizeMode="cover"
            />
          )}
        </ScrollView>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{spot.name}</Text>
          <TouchableOpacity onPress={() => void onToggleLike()} style={styles.likeBtn} hitSlop={12}>
            <Text style={styles.likeEmoji}>{liked ? '❤️' : '🤍'}</Text>
            <Text style={styles.likeLabel}>{liked ? 'Saved' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
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
            <Text style={styles.description}>{repairDisplayText(spot.description)}</Text>
          </>
        )}

        <VenueScamWarningsSection city={String(spot.city || '')} areaLabel={String(spot.neighborhood || spot.address || '')} />

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
  contentDesktop: {
    maxWidth: 980,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  name: { fontSize: 22, fontWeight: '700', color: '#222', flex: 1 },
  likeBtn: { alignItems: 'center' },
  likeEmoji: { fontSize: 22 },
  likeLabel: { fontSize: 11, color: '#666', marginTop: 2 },
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
