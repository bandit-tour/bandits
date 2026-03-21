import { Database } from '@/lib/database.types';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getEventBanditRecommendations, getBanditEventPersonalTip } from '@/app/services/events';

type Event = Database['public']['Tables']['event']['Row'];
type BanditRecommendation = Pick<Database['public']['Tables']['bandit']['Row'], 'id' | 'image_url'>;

// Cache resolved real photo URLs so we don't repeatedly call Google for the same place.
const EVENT_PHOTO_URL_CACHE = new Map<string, string>();

interface EventCardProps {
  event: Event;
  onLike: () => void;
  isLiked: boolean;
  // New variant props for different behaviors
  buttonType?: 'like' | 'remove';
  buttonText?: string;
  showButton?: boolean;
  variant?: 'default' | 'horizontal';
  imageHeight?: number;
  onPress?: () => void;
  banditId?: string; // Optional bandit ID for navigation context
  showRecommendations?: boolean; // Show bandit recommendation icons
  isHighlighted?: boolean;
}

export default function EventCard({
  event,
  onLike,
  isLiked,
  buttonType = 'like',
  buttonText,
  showButton = true,
  variant = 'default',
  imageHeight,
  onPress,
  banditId,
  showRecommendations = false,
  isHighlighted = false,
}: EventCardProps) {
  const router = useRouter();
  const isHorizontal = variant === 'horizontal';
  const [recommendingBandits, setRecommendingBandits] = useState<BanditRecommendation[]>([]);
  const [personalTip, setPersonalTip] = useState<string | null>(null);
  const photoUrlCache = EVENT_PHOTO_URL_CACHE;
  const hasResolvedPhotoRef = useRef(false);

  const sanitizeImageUrl = (uri: string | null | undefined) => {
    if (!uri) return null;
    const trimmed = uri.trim();
    if (!trimmed) return null;
    const lowered = trimmed.toLowerCase();
    // If DB stored the app logo as a placeholder, don't render it.
    if (
      lowered.includes('logobanditourapp') ||
      lowered.includes('banditour') ||
      lowered.includes('bandit-tour')
    ) {
      return null;
    }
    return trimmed;
  };

  const galleryImages = (() => {
    if (!event.image_gallery) return [];
    try {
      const parsed = JSON.parse(event.image_gallery);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((u) => typeof u === 'string' && u.trim())
        .map((u) => sanitizeImageUrl(u as string))
        .filter((u): u is string => Boolean(u));
    } catch {
      return event.image_gallery
        .split(',')
        .map((u) => sanitizeImageUrl(u))
        .filter((u): u is string => Boolean(u));
    }
  })();
  const primaryImage = galleryImages[0] || sanitizeImageUrl(event.image_url) || null;

  const [resolvedPrimaryImageUri, setResolvedPrimaryImageUri] = useState<string | null>(
    null
  );
  const [imageLoading, setImageLoading] = useState<boolean>(true);

  const getGoogleApiKey = () => {
    return (
      (process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY as string | undefined) ??
      (Constants.expoConfig as any)?.android?.config?.googleMaps?.apiKey ??
      (Constants.expoConfig as any)?.ios?.config?.googleMapsApiKey ??
      ''
    );
  };

  const isLogoLikeImageUri = (uri: string) => {
    const lowered = uri.toLowerCase();
    return (
      lowered.includes('logobanditourapp') ||
      lowered.includes('banditour') ||
      lowered.includes('bandit-tour')
    );
  };

  const fetchGooglePlacePhotoUrl = async () => {
    const apiKey = getGoogleApiKey();
    if (!apiKey) return null;

    const query = [event.name, event.address, event.city, event.neighborhood]
      .filter(Boolean)
      .join(' ');

    if (!query.trim()) return null;

    // 1) Find place_id from a text query
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?key=${encodeURIComponent(
      apiKey
    )}&input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id`;

    const findResp = await fetch(findUrl);
    const findJson = await findResp.json();
    const placeId = findJson?.candidates?.[0]?.place_id as string | undefined;
    if (!placeId) return null;

    // 2) Ask for photos via Place Details
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?key=${encodeURIComponent(
      apiKey
    )}&place_id=${encodeURIComponent(placeId)}&fields=photos`;

    const detailsResp = await fetch(detailsUrl);
    const detailsJson = await detailsResp.json();
    const photoRef = detailsJson?.result?.photos?.[0]?.photo_reference as
      | string
      | undefined;
    if (!photoRef) return null;

    // 3) Build an actual photo URL
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(
      photoRef
    )}&key=${encodeURIComponent(apiKey)}`;
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (resolvedPrimaryImageUri) return;
      if (hasResolvedPhotoRef.current) return;
      hasResolvedPhotoRef.current = true;
      setImageLoading(true);

      const cached = photoUrlCache.get(event.id);
      if (cached) {
        if (!cancelled) setResolvedPrimaryImageUri(cached);
        setImageLoading(false);
        return;
      }

      try {
        const photoUrl = await fetchGooglePlacePhotoUrl();
        if (cancelled) return;

        if (photoUrl && !isLogoLikeImageUri(photoUrl)) {
          photoUrlCache.set(event.id, photoUrl);
          setResolvedPrimaryImageUri(photoUrl);
        } else if (primaryImage && !isLogoLikeImageUri(primaryImage)) {
          // Fallback to stored URL only if it doesn't look like the app logo.
          setResolvedPrimaryImageUri(primaryImage);
        }
      } catch (e) {
        console.warn('[EventCard] google photo fetch failed', { eventId: event.id, e });
      } finally {
        if (!cancelled) setImageLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [event.id, resolvedPrimaryImageUri]);

  // Fetch bandit recommendations when showRecommendations is true
  useEffect(() => {
    if (showRecommendations) {
      const fetchRecommendations = async () => {
        try {
          const bandits = await getEventBanditRecommendations(event.id);
          setRecommendingBandits(bandits);
        } catch (error) {
          console.error('Error fetching bandit recommendations:', error);
        }
      };
      fetchRecommendations();
    }
  }, [event.id, showRecommendations]);

  // Fetch bandit's personal tip for this event when banditId is provided
  useEffect(() => {
    if (!banditId) return;
    const loadTip = async () => {
      try {
        const tip = await getBanditEventPersonalTip(banditId, event.id);
        setPersonalTip(tip);
      } catch (error) {
        console.error('Error fetching bandit personal tip:', error);
      }
    };
    loadTip();
  }, [banditId, event.id]);

  const handleCardPress = () => {
    if (onPress) {
      onPress();
    } else {
      // Default navigation to spot detail page
      const url = banditId 
        ? `/spot/${event.id}?banditId=${banditId}` as any
        : `/spot/${event.id}` as any;
      router.push(url);
    }
  };

  const handleLikePress = (e: any) => {
    e.stopPropagation(); // Prevent card press when like button is pressed
    onLike();
  };

  const cardContent = (
    <>
      {/* Event Image - Always show container so bandit icons are visible */}
      <View style={[
        styles.imageContainer, 
        isHorizontal && styles.imageContainerHorizontal,
        ...(imageHeight ? [{ height: imageHeight }] : [])
      ]}>
        {resolvedPrimaryImageUri ? (
          <Image
            source={{ uri: resolvedPrimaryImageUri }}
            style={styles.eventImage}
            resizeMode="cover"
            onError={() => {
              // If an image URL fails to load, re-resolve via Google.
              hasResolvedPhotoRef.current = false;
              setResolvedPrimaryImageUri(null);
              setImageLoading(true);
            }}
          />
        ) : (
          <View style={styles.imageLoadingOverlay}>
            <ActivityIndicator size="small" />
          </View>
        )}
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingText}>{(event.rating || 0).toFixed(1)}</Text>
          <Text style={styles.starText}>★</Text>
        </View>
        
        {/* Bandit Recommendation Icons - Now always visible */}
        {showRecommendations && recommendingBandits.length > 0 && (
          <View style={styles.recommendationsContainer}>
            {recommendingBandits.map((bandit, index) => (
              <TouchableOpacity
                key={bandit.id}
                style={[
                  styles.banditIcon,
                  { zIndex: recommendingBandits.length - index } // Stack icons with proper layering
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push(`/bandit/${bandit.id}` as any);
                }}
              >
                {sanitizeImageUrl(bandit.image_url) ? (
                  <Image
                    source={{ uri: sanitizeImageUrl(bandit.image_url) as string }}
                    style={styles.banditIconImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.banditIconImageLoading}>
                    <ActivityIndicator size="small" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      
      <View style={[
        styles.eventContent,
        isHorizontal && styles.eventContentHorizontal
      ]}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventName}>{event.name || ''}</Text>
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
        <Text style={styles.eventDescription} numberOfLines={3} ellipsizeMode="tail">{event.description || ''}</Text>
        {personalTip && (
          <Text style={styles.personalTip}>
            {`Bandit tip: ${personalTip}`}
          </Text>
        )}
        <View style={styles.bottomInfo}>
          <Text style={styles.eventAddress}>{event.address || ''}</Text>
          {event.timing_info && typeof event.timing_info === 'string' && event.timing_info.trim() && (
            <View style={styles.timeContainer}>
              <Text style={styles.eventTime}>
                {event.timing_info || ''}
              </Text>
            </View>
          )}
        </View>
      </View>
    </>
  );

  return (
    <Pressable
      style={[
        styles.eventCard,
        isHorizontal && styles.eventCardHorizontal,
        !isHorizontal && Platform.OS === 'android' && styles.eventCardAndroid,
        isHighlighted && styles.highlightedCard,
      ]}
      onPress={handleCardPress}
    >
      {cardContent}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eventCard: {
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  eventCardAndroid: {
    minHeight: 300,
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  eventCardHorizontal: {
    width: 192,
    height: 320,
    marginRight: 8,
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
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
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    flexWrap: 'wrap',
    flexShrink: 0,
  },

  eventDescription: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
    marginTop: 2,
    flex: 1,
    minHeight: 0,
    maxHeight: 100, // Prevent description from taking too much space
  },
  bottomInfo: {
    flexShrink: 0,
  },
  eventTime: {
    fontSize: 16,
    color: '#FF0000',
    fontWeight: 'bold',
  },
  timeContainer: {
    marginTop: 4,
  },
  eventImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  eventContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    paddingHorizontal: 2,
    justifyContent: 'space-between',
  },
  eventContentHorizontal: {
    flex: 1,
    padding: 3,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
    flexShrink: 0,
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainerHorizontal: {
    width: '100%',
    aspectRatio: 4 / 3,
    marginBottom: 8,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
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
  banditIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'white',
    marginLeft: -12, // Overlap icons slightly
    overflow: 'hidden',
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
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 18,
  },
  highlightedCard: {
    borderWidth: 2,
    borderColor: '#111',
  },
}); 