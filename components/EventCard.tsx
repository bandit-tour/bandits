import { Database } from '@/lib/database.types';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getEventBanditRecommendations, getBanditEventPersonalTip } from '@/app/services/events';
import LocalBanditOctopusIcon from '@/components/LocalBanditOctopusIcon';
import type { EventListImageScope } from '@/lib/eventListImagePlan';
import { pickVenueGalleryHeroUri } from '@/lib/eventVenueGallery';
import {
  fetchGooglePlacePhotoUrl,
  isGooglePlacesDerivedPhotoUrl,
  isLikelyLogoOrBadPlaceImage,
  normalizeEventImageUri,
} from '@/lib/placePhoto';
import { buildUserFacingVenueFallbackImage, claimVerifiedHeroPhotoUrl } from '@/lib/recommendationImages';
import { repairDisplayText } from '@/lib/repairTextEncoding';

type Event = Database['public']['Tables']['event']['Row'];
type BanditRecommendation = Pick<Database['public']['Tables']['bandit']['Row'], 'id' | 'image_url'>;

// Cache resolved real photo URLs so we don't repeatedly call Google for the same place.
const EVENT_PHOTO_URL_CACHE = new Map<string, string>();

/**
 * Per-card supabase calls (`getEventBanditRecommendations`, `getBanditEventPersonalTip`)
 * were firing on every card mount, so a list of 12 events used to issue 24+
 * round-trips on every focus. These module-level promise caches collapse
 * concurrent and repeated requests to a single in-flight Promise per key,
 * keep the resolved data warm across re-mounts, and expire after 2 minutes so
 * fresh data eventually shows.
 */
const PER_CARD_TTL_MS = 2 * 60 * 1000;
type PerCardCacheEntry<T> = { value: T; expiresAt: number };
const RECOMMENDATIONS_BY_EVENT = new Map<string, Promise<BanditRecommendation[]>>();
const RECOMMENDATIONS_RESOLVED = new Map<string, PerCardCacheEntry<BanditRecommendation[]>>();
const TIPS_BY_KEY = new Map<string, Promise<string | null>>();
const TIPS_RESOLVED = new Map<string, PerCardCacheEntry<string | null>>();

function readFreshFromCache<T>(map: Map<string, PerCardCacheEntry<T>>, key: string): T | undefined {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    map.delete(key);
    return undefined;
  }
  return entry.value;
}

async function getEventBanditRecommendationsCached(eventId: string): Promise<BanditRecommendation[]> {
  const fresh = readFreshFromCache(RECOMMENDATIONS_RESOLVED, eventId);
  if (fresh) return fresh;
  let inflight = RECOMMENDATIONS_BY_EVENT.get(eventId);
  if (!inflight) {
    inflight = (async () => {
      try {
        const v = await getEventBanditRecommendations(eventId);
        RECOMMENDATIONS_RESOLVED.set(eventId, { value: v, expiresAt: Date.now() + PER_CARD_TTL_MS });
        return v;
      } finally {
        RECOMMENDATIONS_BY_EVENT.delete(eventId);
      }
    })();
    RECOMMENDATIONS_BY_EVENT.set(eventId, inflight);
  }
  return inflight;
}

async function getBanditEventPersonalTipCached(banditId: string, eventId: string): Promise<string | null> {
  const key = `${banditId}:${eventId}`;
  const fresh = readFreshFromCache(TIPS_RESOLVED, key);
  if (fresh !== undefined) return fresh;
  let inflight = TIPS_BY_KEY.get(key);
  if (!inflight) {
    inflight = (async () => {
      try {
        const v = await getBanditEventPersonalTip(banditId, eventId);
        TIPS_RESOLVED.set(key, { value: v, expiresAt: Date.now() + PER_CARD_TTL_MS });
        return v;
      } finally {
        TIPS_BY_KEY.delete(key);
      }
    })();
    TIPS_BY_KEY.set(key, inflight);
  }
  return inflight;
}

interface EventCardProps {
  event: Event;
  onLike: () => void;
  isLiked: boolean;
  // New variant props for different behaviors
  buttonType?: 'like' | 'remove';
  buttonText?: string;
  showButton?: boolean;
  variant?: 'default' | 'horizontal';
  /** When variant=horizontal inside a grid/Flex cell, use width 100% instead of fixed carousel width. */
  fillHorizontalCell?: boolean;
  imageHeight?: number;
  onPress?: () => void;
  banditId?: string; // Optional bandit ID for navigation context
  showRecommendations?: boolean; // Show bandit recommendation icons
  isHighlighted?: boolean;
  /** Deprecated: list hero uses strict Places verification + neutral placeholders only. */
  listImageScope?: EventListImageScope | null;
  /** For dense inline lists on native, route card tap should win over overlay avatars. */
  prioritizeCardPress?: boolean;
  /** Pre-resolved recommendation image from list-level dedupe/matching pipeline. */
  resolvedRecommendationImageUri?: string | null;
  /** Enforce strict recommendation image policy from parent list pipeline. */
  strictRecommendationImagePolicy?: boolean;
  /** False while parent is still resolving recommendation hero URLs (shows neutral spacer). */
  recommendationHeroResolverReady?: boolean;
}

function EventCardImpl({
  event,
  onLike,
  isLiked,
  buttonType = 'like',
  buttonText,
  showButton = true,
  variant = 'default',
  fillHorizontalCell = false,
  imageHeight,
  onPress,
  banditId,
  showRecommendations = false,
  isHighlighted = false,
  listImageScope: _listImageScope = null,
  prioritizeCardPress = false,
  resolvedRecommendationImageUri = null,
  strictRecommendationImagePolicy = false,
  recommendationHeroResolverReady = true,
}: EventCardProps) {
  const router = useRouter();
  const isHorizontal = variant === 'horizontal';
  // Seed state from the warm in-memory caches so re-mounts (e.g. tab switch)
  // paint instantly without a flash of empty content while the fetch runs.
  const [recommendingBandits, setRecommendingBandits] = useState<BanditRecommendation[]>(
    () => readFreshFromCache(RECOMMENDATIONS_RESOLVED, event.id) ?? [],
  );
  const [personalTip, setPersonalTip] = useState<string | null>(() => {
    if (!banditId) return null;
    return readFreshFromCache(TIPS_RESOLVED, `${banditId}:${event.id}`) ?? null;
  });
  const photoUrlCache = EVENT_PHOTO_URL_CACHE;

  const sanitizeImageUrl = (uri: string | null | undefined) => {
    const n = normalizeEventImageUri(uri);
    if (!n || isLikelyLogoOrBadPlaceImage(n)) return null;
    return n;
  };

  const isLogoLikeImageUri = (uri: string) => isLikelyLogoOrBadPlaceImage(uri);

  const [googlePhotoUri, setGooglePhotoUri] = useState<string | null>(null);
  const [googleFetchFinished, setGoogleFetchFinished] = useState(false);
  const [strictImageFailed, setStrictImageFailed] = useState(false);
  const googleFetchStarted = useRef(false);

  const userFacingFallbackUri = useMemo(
    () => buildUserFacingVenueFallbackImage(event, `event-card:${event.id}`),
    [event.id, event.name, event.genre, event.address, (event as any).google_place_id],
  );

  const venueGalleryHero = useMemo(
    () => pickVenueGalleryHeroUri(event),
    [event.id, event.image_gallery, event.image_url],
  );

  const displayUri = useMemo(() => {
    const meta = { eventId: event.id, googlePlaceId: (event as any).google_place_id as string | null | undefined };
    if (strictRecommendationImagePolicy) {
      if (!recommendationHeroResolverReady) return userFacingFallbackUri;
      const raw = normalizeEventImageUri(resolvedRecommendationImageUri ?? '');
      if (!raw) return userFacingFallbackUri;
      if (!isGooglePlacesDerivedPhotoUrl(raw)) return raw;
      return claimVerifiedHeroPhotoUrl(raw, meta) ?? userFacingFallbackUri;
    }
    const normalizedVenueGallery = normalizeEventImageUri(venueGalleryHero ?? '');
    if (normalizedVenueGallery) {
      if (isGooglePlacesDerivedPhotoUrl(normalizedVenueGallery)) {
        return claimVerifiedHeroPhotoUrl(normalizedVenueGallery, meta) ?? null;
      }
      return normalizedVenueGallery;
    }
    const normalizedGoogle = normalizeEventImageUri(googlePhotoUri);
    if (!normalizedGoogle) return null;
    return claimVerifiedHeroPhotoUrl(normalizedGoogle, meta) ?? null;
  }, [
    event.id,
    (event as any).google_place_id,
    venueGalleryHero,
    googlePhotoUri,
    googleFetchFinished,
    strictRecommendationImagePolicy,
    resolvedRecommendationImageUri,
    recommendationHeroResolverReady,
    userFacingFallbackUri,
  ]);

  const resolvedImageUri = displayUri;

  const shouldSkipGoogleInListScope = false;

  const fetchPlacePhoto = async () => {
    return fetchGooglePlacePhotoUrl({
      placeId: (event as any).google_place_id ?? null,
      name: String(event.name ?? ''),
      address: String(event.address ?? ''),
      city: String(event.city ?? ''),
      neighborhood: String(event.neighborhood ?? ''),
    });
  };

  /** Reset when event / DB URLs change. */
  useLayoutEffect(() => {
    setStrictImageFailed(false);
    setGooglePhotoUri(null);
    setGoogleFetchFinished(false);
    googleFetchStarted.current = false;
  }, [
    event.id,
    strictRecommendationImagePolicy,
    resolvedRecommendationImageUri ?? '',
  ]);

  /** Always resolve place-name photo first; DB/category remain fallback chain. */
  const loadGooglePhoto = () => {
    if (shouldSkipGoogleInListScope) {
      setGoogleFetchFinished(true);
      return;
    }
    if (googleFetchStarted.current) return;
    googleFetchStarted.current = true;
    const meta = {
      eventId: event.id,
      googlePlaceId: (event as any).google_place_id as string | null | undefined,
    };
    const cached = photoUrlCache.get(event.id);
    if (cached && !isLogoLikeImageUri(cached)) {
      const claimed = claimVerifiedHeroPhotoUrl(cached, meta);
      if (claimed) {
        setGooglePhotoUri(claimed);
        setGoogleFetchFinished(true);
        return;
      }
      photoUrlCache.delete(event.id);
    }
    void (async () => {
      try {
        const photoUrl = await fetchPlacePhoto();
        if (photoUrl && !isLogoLikeImageUri(photoUrl)) {
          const claimed = claimVerifiedHeroPhotoUrl(photoUrl, meta);
          if (claimed) {
            photoUrlCache.set(event.id, claimed);
            setGooglePhotoUri(claimed);
          }
        }
      } catch (e) {
        console.warn('[EventCard] google photo fetch failed', { eventId: event.id, e });
      } finally {
        setGoogleFetchFinished(true);
      }
    })();
  };

  useEffect(() => {
    if (strictRecommendationImagePolicy) return;
    loadGooglePhoto();
  }, [
    event.id,
    event.name,
    event.address,
    event.city,
    event.neighborhood,
    (event as any).google_place_id,
    shouldSkipGoogleInListScope,
    strictRecommendationImagePolicy,
  ]);

  useEffect(() => {
    if (!showRecommendations) return;
    let cancelled = false;
    (async () => {
      try {
        const bandits = await getEventBanditRecommendationsCached(event.id);
        if (!cancelled) setRecommendingBandits(bandits);
      } catch (error) {
        if (!cancelled) console.error('Error fetching bandit recommendations:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event.id, showRecommendations]);

  useEffect(() => {
    if (!banditId) return;
    let cancelled = false;
    (async () => {
      try {
        const tip = await getBanditEventPersonalTipCached(banditId, event.id);
        if (!cancelled) setPersonalTip(tip);
      } catch (error) {
        if (!cancelled) console.error('Error fetching bandit personal tip:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [banditId, event.id]);

  const showImageRegion = true;
  const heroUri =
    strictRecommendationImagePolicy && strictImageFailed
      ? userFacingFallbackUri
      : strictRecommendationImagePolicy
        ? resolvedImageUri ?? userFacingFallbackUri
        : resolvedImageUri ?? (googleFetchFinished ? userFacingFallbackUri : userFacingFallbackUri);

  const fallbackImageUri = userFacingFallbackUri;

  const handleCardPress = useCallback(() => {
    // Warm the next screen's hero image cache before navigating.
    // expo-image will keep the bytes in its memory/disk cache so the detail
    // screen renders the same hero instantly.
    if (heroUri && /^https?:\/\//i.test(heroUri)) {
      void ExpoImage.prefetch(heroUri, 'memory-disk');
    }
    if (onPress) {
      onPress();
    } else {
      const url = banditId
        ? `/spot/${event.id}?banditId=${banditId}` as any
        : `/spot/${event.id}` as any;
      router.push(url);
    }
  }, [heroUri, onPress, banditId, event.id, router]);

  const handleLikePress = useCallback((e: any) => {
    e.stopPropagation();
    onLike();
  }, [onLike]);

  const recommendationsPointerEvents = prioritizeCardPress ? 'none' : 'auto';
  const cardContent = (
    <>
      {showImageRegion ? (
        <View
          style={[
            styles.imageContainer,
            isHorizontal && styles.imageContainerHorizontal,
            ...(imageHeight ? [{ height: imageHeight }] : []),
          ]}
        >
          {heroUri ? (
            <ExpoImage
              source={{ uri: heroUri }}
              style={
                isHorizontal ? styles.eventImageHorizontal : styles.eventImageDefaultContained
              }
              contentFit="cover"
              transition={150}
              // memory + on-disk cache so re-mounting cards (tab switches, scroll
              // unmounts) reuses bytes without a network roundtrip.
              cachePolicy="memory-disk"
              recyclingKey={`event-hero:${event.id}`}
              priority="high"
              accessibilityLabel={
                strictRecommendationImagePolicy
                  ? `recommendation-card-image:${event.id}`
                  : undefined
              }
              onError={() => {
                if (strictRecommendationImagePolicy) {
                  setStrictImageFailed(true);
                  return;
                }
                photoUrlCache.delete(event.id);
                setGooglePhotoUri(null);
              }}
            />
          ) : null}
          {!strictRecommendationImagePolicy && !heroUri && !googleFetchFinished && (
            <View style={styles.imageLoadingSpacer} />
          )}
          <View style={styles.ratingContainer} pointerEvents="none">
            <Text style={styles.ratingText}>{(event.rating || 0).toFixed(1)}</Text>
            <Text style={styles.starText}>★</Text>
          </View>

          {showRecommendations && recommendingBandits.length > 0 && (
            <View style={styles.recommendationsContainer} pointerEvents={recommendationsPointerEvents}>
              {recommendingBandits.map((bandit, index) => (
                <TouchableOpacity
                  key={bandit.id}
                  style={[
                    styles.banditIcon,
                    index > 0 && styles.banditIconOverlap,
                    { zIndex: recommendingBandits.length - index },
                  ]}
                  onPress={(e) => {
                    if (prioritizeCardPress) return;
                    e.stopPropagation();
                    router.push(`/bandits?focusBanditId=${encodeURIComponent(bandit.id)}` as any);
                  }}
                >
                  {sanitizeImageUrl(bandit.image_url) ? (
                    <ExpoImage
                      source={{ uri: sanitizeImageUrl(bandit.image_url) as string }}
                      style={styles.banditIconImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      recyclingKey={`bandit-avatar:${bandit.id}`}
                      transition={120}
                    />
                  ) : (
                    <View style={[styles.banditIconImage, styles.octopusInIcon]}>
                      <LocalBanditOctopusIcon style={{ width: 40, height: 40, marginRight: 0 }} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : (
        <>
          {showRecommendations && recommendingBandits.length > 0 ? (
            <View style={styles.recommendationsRowStandalone} pointerEvents={recommendationsPointerEvents}>
              {recommendingBandits.map((bandit, index) => (
                <TouchableOpacity
                  key={bandit.id}
                  style={[
                    styles.banditIcon,
                    index > 0 && styles.banditIconOverlap,
                    { zIndex: recommendingBandits.length - index },
                  ]}
                  onPress={(e) => {
                    if (prioritizeCardPress) return;
                    e.stopPropagation();
                    router.push(`/bandits?focusBanditId=${encodeURIComponent(bandit.id)}` as any);
                  }}
                >
                  {sanitizeImageUrl(bandit.image_url) ? (
                    <ExpoImage
                      source={{ uri: sanitizeImageUrl(bandit.image_url) as string }}
                      style={styles.banditIconImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      recyclingKey={`bandit-avatar:${bandit.id}`}
                      transition={120}
                    />
                  ) : (
                    <View style={[styles.banditIconImage, styles.octopusInIcon]}>
                      <LocalBanditOctopusIcon style={{ width: 40, height: 40, marginRight: 0 }} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </>
      )}

      <View style={[styles.eventContent, isHorizontal && styles.eventContentHorizontal]}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventName}>{repairDisplayText(event.name || '')}</Text>
          {!showImageRegion ? (
            <View style={styles.ratingContainerInline} pointerEvents="none">
              <Text style={styles.ratingText}>{(event.rating || 0).toFixed(1)}</Text>
              <Text style={styles.starText}>★</Text>
            </View>
          ) : null}
          {showButton && (
            buttonType === 'remove' ? (
              <TouchableOpacity onPress={handleLikePress} style={styles.removeButton}>
                <Text style={styles.removeButtonText}>
                  {buttonText || 'Remove'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleLikePress} style={styles.likeButton}>
                <Text style={[styles.heartIcon, isLiked && styles.heartIconLiked]}>
                  {isLiked ? '❤️' : '🤍'}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
        {event.genre && (
          <Text style={styles.eventGenre}>
            {event.genre}
          </Text>
        )}
        <Text style={[styles.eventDescription, isHorizontal && styles.eventDescriptionHorizontal]}>
          {repairDisplayText(event.description || '')}
        </Text>
        {personalTip && (
          <Text style={[styles.personalTip, isHorizontal && styles.personalTipHorizontal]}>
            {`banDit tip: ${repairDisplayText(personalTip)}`}
          </Text>
        )}
        <View style={[styles.bottomInfo, isHorizontal && styles.bottomInfoHorizontal]}>
          <Text style={[styles.eventAddress, isHorizontal && styles.eventAddressHorizontal]}>
            {repairDisplayText(event.address || '')}
          </Text>
          {event.timing_info && typeof event.timing_info === 'string' && event.timing_info.trim() && (
            <View style={styles.timeContainer}>
              <Text style={styles.eventTime}>
                {repairDisplayText(event.timing_info || '')}
              </Text>
            </View>
          )}
        </View>
      </View>
    </>
  );

  return (
    prioritizeCardPress ? (
      <Pressable
        style={({ pressed }) => [
          styles.eventCard,
          isHorizontal && (fillHorizontalCell ? styles.eventCardHorizontalFluid : styles.eventCardHorizontalStrip),
          !isHorizontal && Platform.OS === 'android' && styles.eventCardAndroid,
          isHighlighted && styles.highlightedCard,
          pressed && styles.eventCardPressed,
        ]}
        onPress={handleCardPress}
        delayPressIn={80}
      >
        {cardContent}
      </Pressable>
    ) : (
      <TouchableOpacity
        style={[
          styles.eventCard,
          isHorizontal && (fillHorizontalCell ? styles.eventCardHorizontalFluid : styles.eventCardHorizontalStrip),
          !isHorizontal && Platform.OS === 'android' && styles.eventCardAndroid,
          isHighlighted && styles.highlightedCard,
        ]}
        onPress={handleCardPress}
        activeOpacity={0.92}
      >
        {cardContent}
      </TouchableOpacity>
    )
  );
}

/**
 * Memo comparator: skip re-renders for the most common parent-state churn
 * (like-set Set replacement, sibling re-mounts). We compare the inputs that
 * actually change the rendered output. `event` is compared by id+rev fields,
 * not full reference, so a new array from a refetch with identical content
 * does not re-render every card.
 */
function areEventCardPropsEqual(prev: EventCardProps, next: EventCardProps): boolean {
  if (prev.event !== next.event) {
    // Most refetches return new event objects even when content is unchanged.
    // Compare the fields that actually drive the card UI.
    const a = prev.event;
    const b = next.event;
    if (
      a.id !== b.id ||
      a.name !== b.name ||
      a.description !== b.description ||
      a.address !== b.address ||
      a.image_url !== b.image_url ||
      a.rating !== b.rating ||
      a.genre !== b.genre ||
      a.timing_info !== b.timing_info ||
      (a as any).google_place_id !== (b as any).google_place_id ||
      JSON.stringify(a.image_gallery ?? null) !== JSON.stringify(b.image_gallery ?? null)
    ) {
      return false;
    }
  }
  return (
    prev.isLiked === next.isLiked &&
    prev.buttonType === next.buttonType &&
    prev.buttonText === next.buttonText &&
    prev.showButton === next.showButton &&
    prev.variant === next.variant &&
    prev.fillHorizontalCell === next.fillHorizontalCell &&
    prev.imageHeight === next.imageHeight &&
    prev.banditId === next.banditId &&
    prev.showRecommendations === next.showRecommendations &&
    prev.isHighlighted === next.isHighlighted &&
    prev.prioritizeCardPress === next.prioritizeCardPress &&
    prev.resolvedRecommendationImageUri === next.resolvedRecommendationImageUri &&
    prev.strictRecommendationImagePolicy === next.strictRecommendationImagePolicy &&
    prev.recommendationHeroResolverReady === next.recommendationHeroResolverReady
    // Note: onLike/onPress are intentionally NOT compared. Parents should
    // pass stable callbacks via useCallback; if they don't, we'd thrash here.
    // In practice these handlers only read the row's `event.id`, so a stale
    // reference still does the right thing.
  );
}

const EventCard = React.memo(EventCardImpl, areEventCardPropsEqual);
export default EventCard;

const styles = StyleSheet.create({
  eventCard: {
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  eventCardPressed: {
    opacity: 0.92,
  },
  eventCardAndroid: {
    minHeight: 300,
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  /** Carousel / map strips — fixed-ish width tiles. */
  eventCardHorizontalStrip: {
    width: 276,
    maxWidth: '92%',
    minWidth: 220,
    marginRight: 8,
    flexShrink: 0,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'visible',
    paddingBottom: 14,
  },
  /** Explore / grid: fills parent column — fixes web skinny column regressions. */
  eventCardHorizontalFluid: {
    width: '100%' as const,
    maxWidth: '100%',
    minWidth: 0,
    marginRight: 0,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    paddingBottom: 14,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  likeButton: {
    padding: 4,
  },
  removeButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  removeButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  heartIcon: {
    fontSize: 20,
  },
  heartIconLiked: {
    fontSize: 20,
  },
  eventName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 0,
    flex: 1,
  },
  eventAddress: {
    fontSize: 13,
    lineHeight: 18,
    color: '#666',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  eventAddressHorizontal: {
    flexShrink: 1,
    marginTop: 4,
  },

  eventDescription: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    marginTop: 2,
    lineHeight: 20,
  },
  eventDescriptionHorizontal: {
    marginBottom: 8,
  },
  personalTipHorizontal: {
    marginBottom: 8,
    marginTop: 2,
  },
  bottomInfo: {
    flexShrink: 0,
  },
  bottomInfoHorizontal: {
    paddingTop: 6,
    width: '100%',
  },
  eventTime: {
    fontSize: 16,
    color: '#FF0000',
    fontWeight: 'bold',
  },
  timeContainer: {
    marginTop: 4,
  },
  /** Vertical/list cards — explicit sizing (avoid web absolute-fill + viewport stretch regressions). */
  eventImageDefaultContained: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 8,
    maxHeight: 320,
  },
  eventImageHorizontal: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 8,
  },
  eventContent: {
    flexGrow: 0,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    paddingHorizontal: 2,
    justifyContent: 'flex-start',
  },
  eventContentHorizontal: {
    flex: 0,
    flexGrow: 0,
    padding: 6,
    paddingBottom: 12,
    justifyContent: 'flex-start',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  octopusInIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  imageContainerHorizontal: {
    width: '100%',
    marginBottom: 8,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  imageLoadingSpacer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: 'transparent',
  },
  ratingContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingContainerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.85)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    flexShrink: 0,
    gap: 4,
  },
  ratingText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 4,
  },
  starText: {
    color: 'white',
    fontSize: 16,
  },
  recommendationsContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendationsRowStandalone: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    paddingRight: 4,
    marginBottom: 4,
    minHeight: 0,
  },
  banditIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'white',
    overflow: 'hidden',
  },
  banditIconOverlap: {
    marginLeft: -12,
  },
  banditIconImage: {
    width: '100%',
    height: '100%',
  },
  banditIconImageLoading: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  eventGenre: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
    marginTop: 2,
    marginBottom: 2,
  },
  personalTip: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
    marginBottom: 8,
    lineHeight: 18,
  },
  highlightedCard: {
    borderWidth: 2,
    borderColor: '#111',
  },
}); 