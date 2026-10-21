import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { getBanditEventPersonalTip, isEventLiked, toggleEventLike } from '@/app/services/events';
import { Database } from '@/lib/database.types';
import { getEventVenueGalleryOrdered } from '@/lib/eventVenueGallery';
import {
  fetchGooglePlacePhotoUrl,
  fetchGooglePlacePhotoUrls,
  fetchTrustedPlaceIdPhotoUrls,
  isEphemeralPlacesMediaUrl,
  isGooglePlacesDerivedPhotoUrl,
  isDurableVenuePhotoUri,
  normalizeEventImageUri,
} from '@/lib/placePhoto';
import { isStaleOrEphemeralVenueHero } from '@/lib/venueHeroRecovery';
import { supabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import ReviewCard from '@/components/ReviewCard';
import { VenueScamWarningsSection } from '@/components/VenueScamWarningsSection';
import { trackEvent } from '@/lib/analytics';
import { VenuePhotoFallback } from '@/components/VenuePhotoFallback';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { useAppBackNavigation, useAppBackScreenOptions } from '@/hooks/useAppBackScreenOptions';
import { consumeExploreOpenedSpot, exploreOpenedSpot } from '@/lib/exploreViewMemory';
import { consumeGuideReturn } from '@/lib/guideViewMemory';
import { repairDisplayText } from '@/lib/repairTextEncoding';
import { routeParamString } from '@/lib/routeParams';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// For City Guide / Explore, the ID passed into /spot/[id] comes from the event card,
// so this screen loads from the event table.
type Spot = Database['public']['Tables']['event']['Row'];
type Bandit = Database['public']['Tables']['bandit']['Row'];

type SpotReview = {
  user_id: string;
  review: string;
  rating: number;
  created_at?: string;
  user_name: string;
};

/** Same PostgREST trap as City Guide: `.single()` throws when the guest session is not ready. */
async function loadSpotEvent(eventId: string): Promise<Spot> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await ensureAnonymousSession().catch(() => undefined);
    const { data, error } = await supabase.from('event').select('*').eq('id', eventId).limit(1);
    const row = Array.isArray(data) ? data[0] : null;
    if (row?.id) return row;
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (error && code !== 'PGRST116') throw error;
    if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 8000));
  }
  throw new Error('Failed to load spot');
}

export default function SpotDetailScreen() {
  const { id: rawId, banditId: rawBanditId, heroUri: rawHeroUri } = useLocalSearchParams<{
    id?: string | string[];
    banditId?: string | string[];
    heroUri?: string | string[];
  }>();
  const id = routeParamString(rawId);
  const spotBanditId = routeParamString(rawBanditId);
  const routeHeroUri = routeParamString(rawHeroUri);
  const { width } = useWindowDimensions();
  const screenOptions = useAppBackScreenOptions({
    title: '',
    fallback: '/explore',
    headerShown: false,
  });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goExplore = useAppBackNavigation('/explore');
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
  const heroHeight = Math.max(240, Math.min(isDesktopWeb ? 420 : 320, Math.round(width * 0.62)));
  const onBackToExplore = useCallback(() => {
    const guideReturn = consumeGuideReturn();
    if (guideReturn) {
      router.replace(guideReturn as never);
      return;
    }
    if (Platform.OS === 'web') {
      const fromExplore = consumeExploreOpenedSpot();
      if (fromExplore) {
        goExplore();
        return;
      }
      router.replace('/explore' as never);
      return;
    }
    goExplore();
  }, [goExplore, router]);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<SpotReview[]>([]);
  const [visibleGallery, setVisibleGallery] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [, setGalleryLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bandit, setBandit] = useState<Bandit | null>(null);
  const [personalTip, setPersonalTip] = useState<string | null>(null);
  const galleryScrollRef = useRef<ScrollView>(null);
  const placesRecoveryStarted = useRef(false);
  const heroWidth = isDesktopWeb ? Math.min(980, width) : width;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    if (exploreOpenedSpot()) return undefined;
    window.history.pushState({ spotDirect: true }, '', window.location.href);
    const onPop = () => {
      const guideReturn = consumeGuideReturn();
      if (guideReturn) {
        router.replace(guideReturn as never);
        return;
      }
      router.replace('/explore' as never);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [router]);

  const mergeGallery = useCallback((uris: string[], seed?: string | null) => {
    const out: string[] = [];
    const push = (raw: string | null | undefined) => {
      const n = normalizeEventImageUri(raw);
      if (!n || !/^https?:\/\//i.test(n)) return;
      if (!out.includes(n)) out.push(n);
    };
    for (const u of uris) push(u);
    if (seed) push(seed);
    return out;
  }, []);

  const fetchLivePlacesGallery = useCallback(
    async (data: Spot, heroSeed?: string | null) => {
      const placeId = (data as { google_place_id?: string | null }).google_place_id ?? null;
      // Trust MVP google_place_id — skip English/Greek name confidence mismatches.
      let placeUrls = placeId ? await fetchTrustedPlaceIdPhotoUrls(placeId, 8) : [];
      if (placeUrls.length === 0) {
        placeUrls = await fetchGooglePlacePhotoUrls({
          placeId,
          name: String(data.name ?? ''),
          address: String(data.address ?? ''),
          city: String(data.city ?? ''),
          neighborhood: String(data.neighborhood ?? ''),
          limit: 8,
        });
      }
      let cleaned = placeUrls
        .map((u) => normalizeEventImageUri(u) ?? u)
        .filter((u) => Boolean(u) && isGooglePlacesDerivedPhotoUrl(u));
      if (cleaned.length === 0) {
        const placeUrl = await fetchGooglePlacePhotoUrl({
          placeId,
          name: String(data.name ?? ''),
          address: String(data.address ?? ''),
          city: String(data.city ?? ''),
          neighborhood: String(data.neighborhood ?? ''),
        });
        const norm = placeUrl ? normalizeEventImageUri(placeUrl) ?? placeUrl : null;
        if (norm && isGooglePlacesDerivedPhotoUrl(norm)) cleaned = [norm];
      }
      return mergeGallery(cleaned, heroSeed);
    },
    [mergeGallery],
  );

  const loadSpot = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!id) return;
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        placesRecoveryStarted.current = false;
        const data = await loadSpotEvent(id as string);
        setSpot(data);
        void trackEvent({
          eventName: 'spot_opened',
          referenceType: 'spot',
          referenceId: String(data.id),
          onceKey: `spot_opened:${data.id}`,
        });

        const parsedGallery = getEventVenueGalleryOrdered(data);
        const heroSeed = routeHeroUri?.trim();
        let gallery = mergeGallery(parsedGallery, heroSeed);
        setVisibleGallery(gallery);
        setGalleryIndex(0);

        const hasStaleOrMissing =
          gallery.length === 0 ||
          gallery.some((u) => isStaleOrEphemeralVenueHero(u)) ||
          !gallery.some((u) => isDurableVenuePhotoUri(u) && !isEphemeralPlacesMediaUrl(u));
        const needsLiveRefresh = hasStaleOrMissing;
        setGalleryLoading(needsLiveRefresh);

        // Stored Places `/media` URLs expire (400). Refresh whenever any gallery URI is
        // missing / ephemeral / Google-derived / non-durable — keep durable URLs first.
        if (needsLiveRefresh) {
          try {
            placesRecoveryStarted.current = true;
            const live = await fetchLivePlacesGallery(data, heroSeed);
            if (live.length > 0) {
              const durable = gallery.filter(
                (u) => isDurableVenuePhotoUri(u) && !isEphemeralPlacesMediaUrl(u) && !isGooglePlacesDerivedPhotoUrl(u),
              );
              gallery = mergeGallery([...durable, ...live], heroSeed);
              setVisibleGallery(gallery);
            }
          } catch (fetchErr) {
            console.warn(
              '[SpotDetail] google photo fetch failed',
              fetchErr instanceof Error ? fetchErr.message : fetchErr,
            );
          } finally {
            setGalleryLoading(false);
          }
        } else {
          setGalleryLoading(false);
        }

        if (spotBanditId) {
          const { data: banditData } = await supabase
            .from('bandit')
            .select('*')
            .eq('id', spotBanditId)
            .maybeSingle();
          if (banditData) {
            setBandit(banditData);
            const tip = await getBanditEventPersonalTip(spotBanditId, String(data.id));
            setPersonalTip(tip);
          } else {
            setBandit(null);
            setPersonalTip(null);
          }
        } else {
          setBandit(null);
          setPersonalTip(null);
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
    [id, routeHeroUri, spotBanditId, mergeGallery, fetchLivePlacesGallery],
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

  const websiteUrl = useMemo(() => {
    const raw = String((spot as any)?.link ?? '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.includes('.') && !raw.includes(' ')) return `https://${raw}`;
    return null;
  }, [spot]);

  const mapsUrl = useMemo(() => {
    if (!spot) return null;
    const addr = String(spot.address || '').trim();
    if (addr) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
    }
    if (spot.location_lat != null && spot.location_lng != null) {
      return `https://www.google.com/maps/search/?api=1&query=${spot.location_lat},${spot.location_lng}`;
    }
    return null;
  }, [spot]);

  const goGallery = useCallback(
    (next: number) => {
      if (visibleGallery.length === 0) return;
      const clamped = Math.max(0, Math.min(visibleGallery.length - 1, next));
      setGalleryIndex(clamped);
      galleryScrollRef.current?.scrollTo({ x: clamped * (heroWidth + 10), animated: true });
    },
    [visibleGallery.length, heroWidth],
  );

  const onShareSpot = useCallback(async () => {
    if (!spot) return;
    try {
      const message = [spot.name, spot.address, websiteUrl].filter(Boolean).join('\n');
      await Share.share({ message, title: spot.name });
    } catch {
      /* user cancelled */
    }
  }, [spot, websiteUrl]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error || !spot) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Spot not found'}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, isDesktopWeb && styles.contentDesktop]}
        refreshControl={spotDetailRefresh}
      >
        <View style={styles.heroStage}>
          <Pressable
            onPress={onBackToExplore}
            style={[styles.profileBack, { top: Math.max(insets.top, 12) }]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back to Explore"
          >
            <Text style={styles.profileBackIcon}>←</Text>
          </Pressable>
        <View style={styles.galleryWrap}>
          <ScrollView
            ref={galleryScrollRef}
            horizontal
            pagingEnabled={false}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryRow}
            onMomentumScrollEnd={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              const idx = Math.round(x / Math.max(heroWidth + 10, 1));
              setGalleryIndex(Math.max(0, Math.min(visibleGallery.length - 1, idx)));
            }}
          >
            {visibleGallery.length > 0 ? (
              visibleGallery.map((uri, index) => (
                <ExpoImage
                  key={`${uri}-${index}`}
                  source={{ uri }}
                  style={[styles.image, { width: heroWidth, height: heroHeight }]}
                  contentFit="cover"
                  transition={120}
                  cachePolicy="memory-disk"
                  recyclingKey={`spot-gallery:${spot.id}:${index}`}
                  priority={index === 0 ? 'high' : 'normal'}
                  onError={() =>
                    setVisibleGallery((prev) => {
                      const next = prev.filter((u) => u !== uri);
                      if (galleryIndex >= next.length) setGalleryIndex(Math.max(0, next.length - 1));
                      if (next.length === 0 && spot && !placesRecoveryStarted.current) {
                        placesRecoveryStarted.current = true;
                        setGalleryLoading(true);
                        void fetchLivePlacesGallery(spot, routeHeroUri?.trim())
                          .then((live) => {
                            if (live.length > 0) {
                              setVisibleGallery(live);
                              setGalleryIndex(0);
                            }
                          })
                          .catch((fetchErr) => {
                            console.warn(
                              '[SpotDetail] gallery recovery failed',
                              fetchErr instanceof Error ? fetchErr.message : fetchErr,
                            );
                          })
                          .finally(() => setGalleryLoading(false));
                      }
                      return next;
                    })
                  }
                />
              ))
            ) : (
              <VenuePhotoFallback
                name={String(spot.name || '')}
                genre={spot.genre}
                style={{ width: heroWidth, height: heroHeight, aspectRatio: undefined, maxHeight: heroHeight }}
              />
            )}
          </ScrollView>
          {visibleGallery.length > 1 ? (
            <View style={styles.galleryControls}>
              <Pressable
                onPress={() => goGallery(galleryIndex - 1)}
                disabled={galleryIndex <= 0}
                style={[styles.galleryNavBtn, galleryIndex <= 0 && styles.galleryNavBtnDisabled]}
                hitSlop={8}
              >
                <Text style={styles.galleryNavText}>‹</Text>
              </Pressable>
              <Text style={styles.galleryCounter}>
                {galleryIndex + 1} / {visibleGallery.length}
              </Text>
              <Pressable
                onPress={() => goGallery(galleryIndex + 1)}
                disabled={galleryIndex >= visibleGallery.length - 1}
                style={[
                  styles.galleryNavBtn,
                  galleryIndex >= visibleGallery.length - 1 && styles.galleryNavBtnDisabled,
                ]}
                hitSlop={8}
              >
                <Text style={styles.galleryNavText}>›</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        </View>

        <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{repairDisplayText(spot.name || '')}</Text>
          <View style={styles.titleActions}>
            <TouchableOpacity onPress={() => void onShareSpot()} style={styles.likeBtn} hitSlop={12}>
              <Text style={styles.likeEmoji}>↗</Text>
              <Text style={styles.likeLabel}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void onToggleLike()} style={styles.likeBtn} hitSlop={12}>
              <Text style={styles.likeEmoji}>{liked ? '❤️' : '🤍'}</Text>
              <Text style={styles.likeLabel}>{liked ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.metaRow}>
          {!!spot.genre && <Text style={styles.category}>{spot.genre}</Text>}
          {typeof spot.rating === 'number' && spot.rating > 0 ? (
            <Text style={styles.rating}>★ {spot.rating.toFixed(1)}</Text>
          ) : null}
        </View>
        {spot.city ? <Text style={styles.city}>{spot.city}</Text> : null}

        {!!spot.address && (
          <TouchableOpacity
            onPress={() => {
              if (mapsUrl) void Linking.openURL(mapsUrl);
            }}
          >
            <Text style={styles.addressValue}>{repairDisplayText(spot.address || '')}</Text>
          </TouchableOpacity>
        )}

        {spot.description ? (
          <Text style={styles.description}>{repairDisplayText(spot.description)}</Text>
        ) : null}

        {spot.timing_info && String(spot.timing_info).trim() ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Hours</Text>
            <Text style={styles.sectionBody}>{repairDisplayText(spot.timing_info)}</Text>
          </View>
        ) : null}

        {bandit && personalTip ? (
          <View style={styles.tipBlock}>
            <View style={styles.tipTitleRow}>
              {bandit.image_url ? (
                <ExpoImage
                  source={{ uri: bandit.image_url }}
                  style={styles.tipAvatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#1c2228',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: '#c4a35a', fontWeight: '700', fontSize: 12 }}>
                    {(bandit.name || 'LB').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.sectionTitle}>{`${bandit.name}'s tip`}</Text>
            </View>
            <Text style={styles.sectionBody}>{repairDisplayText(personalTip)}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          {mapsUrl ? (
            <TouchableOpacity style={styles.actionBtn} onPress={() => void Linking.openURL(mapsUrl)}>
              <Text style={styles.actionBtnText}>Directions</Text>
            </TouchableOpacity>
          ) : null}
          {websiteUrl ? (
            <TouchableOpacity style={styles.actionBtn} onPress={() => void Linking.openURL(websiteUrl)}>
              <Text style={styles.actionBtnText}>Website</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <VenueScamWarningsSection
          city={String(spot.city || '')}
          areaLabel={String(spot.neighborhood || spot.address || '')}
        />

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
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingBottom: 28 },
  contentDesktop: {
    maxWidth: 980,
    width: '100%',
    alignSelf: 'center',
  },
  heroStage: { position: 'relative', width: '100%' },
  profileBack: {
    position: 'absolute',
    left: 12,
    zIndex: 4,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  profileBackIcon: { fontSize: 28, fontWeight: '700', color: '#111111', lineHeight: 32 },
  body: { paddingHorizontal: 16, paddingTop: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#FF3B30' },
  galleryWrap: { marginBottom: 8 },
  image: {
    height: 280,
    marginRight: 0,
    backgroundColor: '#F0F0F0',
  },
  imageLoadingOverlay: {
    height: 200,
    borderRadius: 12,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  heroPendingApproval: {
    height: 200,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: '#ECECEC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  heroPendingApprovalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  galleryRow: { paddingBottom: 8 },
  galleryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  galleryNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryNavBtnDisabled: { opacity: 0.35 },
  galleryNavText: { fontSize: 22, fontWeight: '600', color: '#222', lineHeight: 24 },
  galleryCounter: { fontSize: 13, color: '#666', fontWeight: '600' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 22, fontWeight: '700', color: '#222', flex: 1 },
  likeBtn: { alignItems: 'center' },
  likeEmoji: { fontSize: 22 },
  likeLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  category: { fontSize: 14, color: '#666' },
  rating: { fontSize: 14, fontWeight: '700', color: '#222' },
  city: { fontSize: 14, color: '#555', marginBottom: 12 },
  addressLabel: { fontSize: 13, fontWeight: '700', color: '#222', marginBottom: 2 },
  addressValue: { fontSize: 14, color: '#0A63C9', marginBottom: 12, lineHeight: 20 },
  description: { fontSize: 14, color: '#3C3C3C', lineHeight: 20, marginBottom: 12 },
  sectionBlock: { marginBottom: 14 },
  tipBlock: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
  },
  tipTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  tipAvatar: { width: 36, height: 36, borderRadius: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 4 },
  sectionBody: { fontSize: 14, color: '#3C3C3C', lineHeight: 20 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  actionBtn: {
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
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
