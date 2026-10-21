import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView as RNScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getBanditById, getBanditTags, submitBanditQuestion, toggleBanditLike } from '@/app/services/bandits';
import { getBanditEventCategories, getEvents } from '@/app/services/events';
import { formatAskMeModalSubtitle } from '@/lib/askMeMessageFormat';
import { ASK_ME_SUCCESS_MESSAGE, userFacingMessagingError } from '@/lib/userFacingMessagingError';
import { useKeyboardBottomInset } from '@/lib/useKeyboardBottomInset';
import { useAppBackScreenOptions } from '@/hooks/useAppBackScreenOptions';
import { getBanditReviews } from '@/app/services/reviews';
import { supabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { BANDITS_ROWS_CACHE_KEY, warmBanditsHomeCache } from '@/lib/banditsHomeCache';
import { readCacheStale } from '@/lib/appDataCache';
import { resolveWhyFollowText } from '@/services/whyFollowCopy';
import { getNotificationsBackendStatus } from '@/services/localFriend';

import AppEscapeNav from '@/components/AppEscapeNav';
import BanditHeader from '@/components/BanditHeader';
import { BanditOrchestraStrip } from '@/components/BanditOrchestraStrip';
import EventCard from '@/components/EventCard';
import { GuestDiscoveryCard } from '@/components/GuestDiscoveryCard';
import PremiumUnlockModal from '@/components/modals/PremiumUnlockModal';
import ReviewCard from '@/components/ReviewCard';
import TagChip from '@/components/TagChip';
import { goToAppHome } from '@/lib/appNavigation';
import { resolveRegisteredBanditId } from '@/lib/guest-workspace/registeredBanditIds';

import { TAG_EMOJI_MAP } from '@/constants/tagNameToEmoji';
import { Database } from '@/lib/database.types';
import { repairDisplayText } from '@/lib/repairTextEncoding';
import { buildEventListImagePlan } from '@/lib/eventListImagePlan';
import { resolveApprovedListHeroUrisByEventId } from '@/lib/recommendationImages';
import { trackEvent } from '@/lib/analytics';
import { logNativeNav } from '@/lib/nativeNavLog';
import { routeParamString } from '@/lib/routeParams';
import {
  fetchBanditPremiumVisibility,
  invalidateBanditPremiumVisibilityCache,
  type BanditPremiumVisibility,
} from '@/lib/guest-app/premium-visibility';
import { OCTOPUS_CONCIERGE_OFFER } from '@/lib/octopus-concierge/principle';
import OctopusConciergeExperience from '@/components/OctopusConciergeExperience';

type Bandit = Database['public']['Tables']['bandit']['Row'];

type DisplayReview = {
  user_id: string;
  review: string;
  rating: number;
  created_at?: string;
  user_name: string;
};

type EventCategory = {
  genre: 'Food' | 'Culture' | 'Nightlife' | 'Shopping' | 'Coffee';
  count: number;
};

type EventItem = Database['public']['Tables']['event']['Row'];

/** RN ScrollView only — nested VirtualizedList inside GH ScrollView hard-crashes iOS. */
const ProfileScrollView = RNScrollView;

const FALLBACK_HANDLES = [
  'athens.nights',
  'city.mosaic',
  'street.coffee',
  'rooftop.sonic',
  'plaka.walks',
  'vinyl.corner',
  'gallery.loop',
];

function buildFallbackReviews(banditId: string, banditName: string): DisplayReview[] {
  const nameSeed = (banditName || 'local').replace(/\s+/g, '').toLowerCase();
  const shift = nameSeed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % FALLBACK_HANDLES.length;
  return FALLBACK_HANDLES.map((_, index) => {
    const handle = FALLBACK_HANDLES[(index + shift) % FALLBACK_HANDLES.length];
    return {
    user_id: `${banditId}-sample-${index + 1}`,
    user_name: `${handle}.${nameSeed}`,
    review:
      index % 2 === 0
        ? `Great picks from ${banditName}. The route felt local and practical.`
        : `Saved this for my next night out. Spots were real and easy to reach.`,
    rating: index === 4 ? 4 : 5,
    };
  });
}

export default function BanditScreen() {
  const router = useRouter();
  const screenOptions = useAppBackScreenOptions({
    title: 'Local banDit',
    fallback: '/profile',
    escapeShortcuts: true,
  });
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const rawParam = routeParamString(rawId);
  /** Resolve commercial/demo aliases; never query invented non-UUID ids. */
  const id = resolveRegisteredBanditId(rawParam) ?? (rawParam || '');
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardBottomInset();

  const [bandit, setBandit] = useState<Bandit | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [reviews, setReviews] = useState<DisplayReview[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [genreEvents, setGenreEvents] = useState<EventItem[]>([]);
  const [loadingGenreEvents, setLoadingGenreEvents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [askOpen, setAskOpen] = useState(false);
  const [askText, setAskText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [askNotificationsHint, setAskNotificationsHint] = useState<string | null>(null);
  const [likeUserId, setLikeUserId] = useState<string | null>(null);
  const [galleryExtras, setGalleryExtras] = useState<string[]>([]);
  const [premiumVis, setPremiumVis] = useState<BanditPremiumVisibility | null>(null);
  const [premiumUnlockOpen, setPremiumUnlockOpen] = useState(false);
  const askTargetBanditIdRef = useRef<string>('');

  const refreshPremiumVisibility = useCallback(() => {
    if (!id) {
      setPremiumVis(null);
      return;
    }
    invalidateBanditPremiumVisibilityCache(id);
    void fetchBanditPremiumVisibility(id).then(setPremiumVis);
  }, [id]);

  useEffect(() => {
    refreshPremiumVisibility();
  }, [refreshPremiumVisibility]);

  useFocusEffect(
    useCallback(() => {
      refreshPremiumVisibility();
    }, [refreshPremiumVisibility]),
  );

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('banDit not found');
      return;
    }
    const banditIdStr = id;
    let cancelled = false;

    const fetchBanditData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Cold /bandit/{id} used to query before the anonymous session and
        // list cache existed, so a real profile came back as not-found.
        await ensureAnonymousSession().catch(() => undefined);
        if (cancelled) return;

        // Resolve user identity once via cached helper (avoids serialized
        // auth lock latency).
        const cachedUser = await import('@/lib/authUserCache').then((m) => m.getCachedAuthUser());
        const uid = cachedUser?.id ?? null;
        setLikeUserId(uid);

        const readProfile = () => getBanditById(banditIdStr, uid);
        let loaded = await readProfile();
        if (!loaded) {
          await warmBanditsHomeCache().catch(() => undefined);
          if (cancelled) return;
          loaded = await readProfile();
        }
        if (!loaded) {
          const rows = readCacheStale<Array<{ bandit?: { id?: string } }>>(BANDITS_ROWS_CACHE_KEY);
          const cached = rows?.find((row) => row.bandit?.id === banditIdStr)?.bandit;
          if (cached && typeof cached === 'object' && 'name' in cached) {
            loaded = cached as Bandit;
          }
        }

        // Tags, categories, and reviews race alongside the resolved profile.
        const banditPromise = Promise.resolve(loaded);
        const tagsPromise: Promise<any[]> = getBanditTags(banditIdStr).catch(() => []);
        const categoriesPromise: Promise<any[]> = getBanditEventCategories(banditIdStr).catch(() => []);
        const reviewsPromise: Promise<any[]> = getBanditReviews(banditIdStr).catch(() => []);
        const galleryPromise: Promise<string[]> = getEvents({ banditId: banditIdStr })
          .then((events) => {
            const out: string[] = [];
            for (const ev of events || []) {
              const candidates = [
                (ev as any).recommendation_place_photo_url,
                (ev as any).bandit_photo_url,
                (ev as any).google_photo_url,
                ev.image_url,
              ];
              for (const u of candidates) {
                const t = typeof u === 'string' ? u.trim() : '';
                if (
                  (t.startsWith('https://') || t.startsWith('http://')) &&
                  !out.includes(t)
                ) {
                  out.push(t);
                }
                if (out.length >= 6) return out;
              }
            }
            return out;
          })
          .catch(() => [] as string[]);

        const [banditData, tagData, catData, raw, extras] = await Promise.all([
          banditPromise,
          tagsPromise,
          categoriesPromise,
          reviewsPromise,
          galleryPromise,
        ]);

        if (cancelled) return;
        if (!banditData) throw new Error('banDit not found');
        setBandit(banditData);
        setGalleryExtras(extras);
        void trackEvent({
          eventName: 'bandit_profile_opened',
          referenceType: 'bandit',
          referenceId: banditData.id,
          onceKey: `bandit_profile_opened:${banditData.id}`,
        });
        setTags(tagData ?? []);
        setCategories(catData ?? []);

        const mapped: DisplayReview[] = (raw || []).map((r: any) => ({
          user_id: r.user_id ?? 'anon',
          review: r.review ?? '',
          rating: typeof r.rating === 'number' ? r.rating : 5,
          created_at: r.created_at,
          user_name: r.user_name ?? 'local wanderer',
        }));
        const limited = mapped.slice(0, 5);
        setReviews(
          limited.length > 0
            ? limited
            : buildFallbackReviews(banditData.id, banditData.name).slice(0, 3),
        );
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : err && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'This Local banDit is unavailable.';
        if (!cancelled) {
          setError(msg.includes('uuid') || msg.includes('22P02') ? 'This Local banDit is unavailable.' : msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchBanditData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    (async () => {
      await ensureAnonymousSession();
      const status = await getNotificationsBackendStatus();
      if (!active) return;
      setAskNotificationsHint(
        status.enabled ? null : 'Enable notifications to get replies faster. You can still send now.',
      );
    })();
    return () => {
      active = false;
    };
  }, []);

  const genreEventsRenderable = useMemo(
    () => genreEvents.filter((e) => String(e?.id ?? '').trim().length > 0),
    [genreEvents],
  );

  const genreImagePlan = useMemo(
    () =>
      genreEventsRenderable.length > 0
        ? buildEventListImagePlan(genreEventsRenderable)
        : null,
    [genreEventsRenderable],
  );

  const genreRecommendationImageById = useMemo(
    () => resolveApprovedListHeroUrisByEventId(genreEventsRenderable),
    [genreEventsRenderable],
  );

  const handleCategoryPress = useCallback(
    async (genre: string) => {
      const bid = String(bandit?.id ?? id ?? '').trim();
      if (!bid) return;
      logNativeNav('profile.category.tap', { banditId: bid, genre });
      // Tap same chip to collapse and keep user on profile.
      if (selectedGenre === genre) {
        setSelectedGenre(null);
        setGenreEvents([]);
        return;
      }
      setSelectedGenre(genre);
      setGenreEvents([]);
      setLoadingGenreEvents(true);
      try {
        const events = await getEvents({ banditId: bid, genre });
        const safe = (events ?? []).filter((e) => String(e?.id ?? '').trim().length > 0);
        logNativeNav('profile.category.loaded', { banditId: bid, genre, count: safe.length });
        setGenreEvents(safe);
      } catch (err) {
        logNativeNav('profile.category.error', {
          banditId: bid,
          genre,
          message: err instanceof Error ? err.message : String(err),
        });
        setGenreEvents([]);
      } finally {
        setLoadingGenreEvents(false);
      }
    },
    [bandit?.id, id, selectedGenre],
  );

  const handleBanditLike = useCallback(
    async (banditId: string, currentLikeStatus: boolean) => {
      setBandit((prev) => (prev ? { ...prev, is_liked: !currentLikeStatus } : prev));
      try {
        await toggleBanditLike(banditId, currentLikeStatus, likeUserId);
      } catch (e) {
        setBandit((prev) => (prev ? { ...prev, is_liked: currentLikeStatus } : prev));
        const msg = e instanceof Error ? e.message : '';
        Alert.alert('Follow unavailable', msg || 'Could not update follow state.');
      }
    },
    [likeUserId],
  );

  const onHeaderCategoryPress = useCallback(
    (genre: string) => {
      void handleCategoryPress(genre);
    },
    [handleCategoryPress],
  );

  const categoryExpandBelow =
    selectedGenre && bandit ? (
      <View style={styles.inlineCategorySection} pointerEvents="box-none" collapsable={false}>
        <View style={styles.inlineCategoryHeader}>
          <Text style={styles.inlineCategoryTitle}>{selectedGenre} picks</Text>
          <Pressable
            onPress={() => {
              setSelectedGenre(null);
              setGenreEvents([]);
            }}
            hitSlop={6}
          >
            <Text style={styles.inlineCategoryCollapse}>Hide</Text>
          </Pressable>
        </View>
        {loadingGenreEvents ? (
          <ActivityIndicator size="small" />
        ) : genreEventsRenderable.length === 0 ? (
          <Text style={styles.inlineCategoryEmpty}>No spots in this category yet.</Text>
        ) : (
          <View style={styles.inlineCategoryGrid} pointerEvents="box-none">
            {genreEventsRenderable.map((event) => {
              const eventId = String(event.id).trim();
              return (
                <View
                  key={eventId}
                  style={[
                    styles.inlineSpotCardWrap,
                    isDesktopWeb && styles.inlineSpotCardWrapDesktop,
                  ]}
                >
                  <EventCard
                    event={event}
                    onLike={() => undefined}
                    isLiked={false}
                    showButton={false}
                    variant="horizontal"
                    fillHorizontalCell
                    showRecommendations={false}
                    prioritizeCardPress
                    splitTouchTargets={Platform.OS !== 'web'}
                    skipGooglePhotoFetch={Boolean(genreRecommendationImageById[eventId])}
                    listImageScope={genreImagePlan?.get(eventId) ?? null}
                    resolvedRecommendationImageUri={genreRecommendationImageById[eventId] ?? null}
                    recommendationHeroResolverReady
                    strictRecommendationImagePolicy={false}
                    onPress={() =>
                      router.push(
                        `/spot/${encodeURIComponent(eventId)}?banditId=${encodeURIComponent(bandit.id)}` as any,
                      )
                    }
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>
    ) : null;


  if (loading) {
    return (
      <View style={styles.stateScreen} testID="bandit-profile-loading">
        <Stack.Screen options={screenOptions} />
        <View style={[styles.stateEscapePad, { paddingTop: Math.max(insets.top, 8) + 8 }]}>
          <AppEscapeNav backFallback="/profile" />
        </View>
        <View style={styles.stateBody}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingHint}>Loading Local banDit…</Text>
          <Pressable
            style={styles.escapeHomeBtn}
            onPress={() => goToAppHome(router)}
            accessibilityRole="button"
            accessibilityLabel="Go Home"
          >
            <Text style={styles.escapeHomeText}>Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (error || !bandit) {
    return (
      <View style={styles.stateScreen} testID="bandit-profile-error">
        <Stack.Screen options={screenOptions} />
        <View style={[styles.stateEscapePad, { paddingTop: Math.max(insets.top, 8) + 8 }]}>
          <AppEscapeNav backFallback="/profile" />
        </View>
        <View style={styles.stateBody}>
          <Text style={styles.errorText}>{error ?? 'This Local banDit is unavailable.'}</Text>
          <Text style={styles.errorSub}>
            The profile link may be outdated. Go back to your story, or return Home.
          </Text>
          <Pressable
            style={styles.escapeHomeBtn}
            onPress={() => goToAppHome(router)}
            accessibilityRole="button"
            accessibilityLabel="Go Home"
            testID="bandit-error-home"
          >
            <Text style={styles.escapeHomeText}>Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const handleAskMePress = () => {
    const frozenBanditId = String(bandit?.id || '').trim();
    askTargetBanditIdRef.current = frozenBanditId;
    setAskOpen(true);
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const handleAskSubmit = async () => {
    const frozenBanditId = String(askTargetBanditIdRef.current || '').trim();
    if (!askText.trim() || !frozenBanditId) return;
    try {
      setSubmitting(true);
      setSubmitError(null);
      await ensureAnonymousSession();
      console.log('ASK TARGET', frozenBanditId);
      await submitBanditQuestion(frozenBanditId, askText.trim());
      setSubmitSuccess(true);
      setAskText('');
    } catch (e) {
      setSubmitError(userFacingMessagingError(e).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={screenOptions} />

      <ProfileScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          isDesktopWeb && styles.contentContainerDesktop,
        ]}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
      >
        {/* HEADER + CATEGORIES + inline accordion under chips */}
        <BanditHeader
          bandit={bandit}
          categories={categories}
          selectedGenre={selectedGenre}
          variant="detail"
          showActionButtons
          onCategoryPress={onHeaderCategoryPress}
          onLike={handleBanditLike}
          onMeet={handleAskMePress}
          categoryExpandBelow={categoryExpandBelow}
          galleryExtras={galleryExtras}
          {...(premiumVis ? { premiumVisibility: premiumVis } : {})}
        />

        <View style={styles.orchestraStripWrap}>
          <BanditOrchestraStrip bandit={bandit} categories={categories} />
        </View>

        <View style={[styles.profileBodyGrid, isDesktopWeb && styles.profileBodyGridDesktop]}>
          <View style={styles.profileMainCol}>
            {!!bandit.description && (
              <View style={styles.aboutSection}>
                <Text style={styles.sectionLabel}>About</Text>
                <Text style={styles.description}>{bandit.description}</Text>
              </View>
            )}

            {tags.length > 0 && (
              <View style={styles.vibesSection}>
                <Text style={styles.vibesLabel}>Interests</Text>
                <RNScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.vibesContainer}
                >
                  {tags.map((tag, index) => (
                    <TagChip
                      key={index}
                      label={`${TAG_EMOJI_MAP[tag] ?? '✨'} ${tag}`}
                    />
                  ))}
                </RNScrollView>
              </View>
            )}

            {premiumVis?.showPremiumInsights ? (
              <View style={{ marginBottom: 14 }}>
                <GuestDiscoveryCard
                  promptId="bandit_local_insider"
                  eyebrow="Local Insider"
                  title={`Go deeper with ${bandit.name}`}
                  body={`Stay Pass ${OCTOPUS_CONCIERGE_OFFER.priceLabel} — ${OCTOPUS_CONCIERGE_OFFER.periodLabel}. City Guide and Ask Me stay free.`}
                  cta="See Stay Pass offer"
                  href={`/premium/${encodeURIComponent(String(bandit.id))}`}
                  onCtaPress={() => setPremiumUnlockOpen(true)}
                  testID="bandit-journey-local-insider"
                />
              </View>
            ) : premiumVis?.aiOperated === true && premiumVis.octopusVerified !== true ? (
              <OctopusConciergeExperience
                embedded
                banditId={String(bandit.id)}
                banditName={String(bandit.name || 'Local banDit')}
                portraitUri={String(bandit.image_url || bandit.face_image_url || '')}
                checkoutEnabled={false}
                aiOperated
              />
            ) : null}

            <Text style={styles.whyFollowLabel}>
              {`Why follow ${bandit.name}?`}
            </Text>

            <View style={styles.why_follow}>
              {(() => {
                const wf = resolveWhyFollowText(bandit).trim();
                if (!wf) return null;
                const lines = wf
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean);
                return lines.map((line, i) => (
                  <Text key={i} style={styles.whyFollowBullet}>
                    {line.startsWith('•') ? repairDisplayText(line) : `• ${repairDisplayText(line)}`}
                  </Text>
                ));
              })()}
            </View>
          </View>

          <View style={styles.profileSideCol}>
            <View style={styles.reviewsSection}>
              <Text style={styles.reviewsTitle}>
                Reviews <Text style={styles.reviewsCount}>({reviews.length})</Text>
              </Text>

              {reviews.length > 0 && (
                <RNScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.reviewsContainer}
                >
                  {reviews.map((review, index) => (
                    <ReviewCard key={index} review={review} />
                  ))}
                </RNScrollView>
              )}
            </View>
          </View>
        </View>

        {/* CTA */}
        <Pressable style={styles.askMeButton} onPress={handleAskMePress}>
          <Text style={styles.askMeText}>Ask me</Text>
        </Pressable>
      </ProfileScrollView>

      {bandit && premiumVis?.showPremiumInsights ? (
        <PremiumUnlockModal
          visible={premiumUnlockOpen}
          onClose={() => setPremiumUnlockOpen(false)}
          banditId={String(bandit.id)}
          banditName={String(bandit.name || 'Local banDit')}
        />
      ) : null}

      <Modal
        visible={askOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          Keyboard.dismiss();
          setAskOpen(false);
        }}
      >
        {/**
         * Bottom sheet: title scrolls; input + Send share one compose block lifted by keyboard inset.
         */}
        <View style={styles.askModalRoot}>
          <View style={styles.askOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                Keyboard.dismiss();
                setAskOpen(false);
              }}
              accessibilityLabel="Dismiss"
            />
            <View
              style={[
                styles.askCard,
                {
                  paddingBottom: Math.max(insets.bottom, 12) + keyboardInset,
                },
              ]}
            >
              <RNScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.askScrollInner}
                style={styles.askScroll}
              >
                <Text style={styles.askTitle}>{`Ask ${bandit.name}`}</Text>
                <Text style={styles.askSubtitle}>
                  {`Ask anything about the city, spots, or vibes. ${bandit.name} gets your question — you’ll see your message in Chat, and replies there too.`}
                </Text>
                {submitError && (
                  <Text style={styles.askError}>{submitError}</Text>
                )}
                {!!askNotificationsHint && <Text style={styles.askHint}>{askNotificationsHint}</Text>}
                {submitSuccess && (
                  <Text style={styles.askSuccess}>{ASK_ME_SUCCESS_MESSAGE}</Text>
                )}
              </RNScrollView>

              <TextInput
                style={styles.askInput}
                multiline
                placeholder="Type your question..."
                placeholderTextColor="#999"
                value={askText}
                onChangeText={setAskText}
              />

              <View style={styles.askActions}>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setAskOpen(false);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.askCancel}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAskSubmit}
                  disabled={submitting || !askText.trim()}
                  style={[
                    styles.askSubmitButton,
                    (submitting || !askText.trim()) && styles.askSubmitButtonDisabled,
                  ]}
                >
                  <Text style={styles.askSubmitText}>
                    {submitting ? 'Sending…' : 'Send'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 1220,
    alignSelf: 'center',
  },
  contentContainerDesktop: {
    paddingHorizontal: 24,
  },
  profileBodyGrid: {
    width: '100%',
  },
  profileBodyGridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  profileMainCol: {
    flex: 1,
    minWidth: 0,
  },
  profileSideCol: {
    flex: 1,
    minWidth: 0,
  },
  description: {
    fontSize: 14,
    color: '#3C3C3C',
    lineHeight: 21,
  },
  aboutSection: {
    marginBottom: 16,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B6B6B',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cityGuidePreview: {
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#111111',
  },
  cityGuidePreviewTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  cityGuidePreviewSub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 18,
  },
  routesEntry: {
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FAF9F7',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  routesEntryTitle: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  routesEntrySub: {
    color: '#6B6B6B',
    fontSize: 13,
    lineHeight: 18,
  },
  orchestraStripWrap: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  premiumEntry: {
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#181818',
    borderWidth: 1.5,
    borderColor: 'rgba(224, 49, 49, 0.45)',
  },
  premiumEntryTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  premiumEntrySub: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 13,
    lineHeight: 18,
  },
  passportBlock: {
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
  },
  passportTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#6B6B6B',
    marginBottom: 6,
  },
  passportBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#3C3C3C',
  },
  passportLink: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#E03131',
  },
  whyFollowLabel: {
    fontWeight: '600',
    fontSize: 13,
    color: '#3C3C3C',
    marginBottom: 10,
  },
  why_follow: {
    marginLeft: 8,
    marginBottom: 8,
  },
  whyFollowBullet: {
    fontSize: 14,
    color: '#3C3C3C',
    marginBottom: 8,
    lineHeight: 20,
  },

  reviewsSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  reviewsTitle: {
    fontFamily: 'Caros',
    fontWeight: '800',
    fontSize: 22,
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
  vibesSection: {
    marginTop: 8,
    marginBottom: 12,
  },
  
  vibesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6B6B',
    marginBottom: 6,
  },
  
  vibesContainer: {
    paddingVertical: 4,
  },
  inlineCategorySection: {
    marginTop: 4,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E2E2',
    gap: 10,
  },
  inlineCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inlineCategoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#202020',
  },
  inlineCategoryCollapse: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111111',
  },
  inlineCategoryEmpty: {
    fontSize: 13,
    color: '#666',
  },
  inlineCategoryGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-start',
  },
  inlineSpotCardWrap: {
    width: '100%',
  },
  inlineSpotCardWrapDesktop: {
    width: '48.8%',
  },
  
  askMeButton: {
    backgroundColor: '#ff0000',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 30,
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  askMeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Caros',
  },

  stateScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stateEscapePad: {
    paddingHorizontal: 16,
  },
  stateBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  loadingHint: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  errorSub: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
    textAlign: 'center',
    maxWidth: 360,
  },
  escapeHomeBtn: {
    marginTop: 8,
    backgroundColor: '#111111',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  escapeHomeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  askModalRoot: {
    flex: 1,
  },
  askOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    width: '100%',
    overflow: 'hidden',
  },
  /**
   * Bottom-sheet card. We deliberately do NOT cap maxHeight here — KeyboardAvoidingView
   * pushes the card up so the input + sticky Send footer remain visible. A hard cap
   * caused the previous "screen jumps sideways / gets cut off" bug.
   */
  askCard: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxWidth: '100%',
    maxHeight: '88%',
    alignSelf: 'stretch',
    zIndex: 10,
  },
  askScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  askScrollInner: {
    paddingBottom: 12,
    width: '100%',
  },
  askTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  askSubtitle: {
    fontSize: 13,
    color: '#555',
    marginBottom: 8,
  },
  askInput: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#000',
    marginBottom: 8,
  },
  askError: {
    fontSize: 12,
    color: '#FF3B30',
    marginBottom: 4,
  },
  askHint: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
    lineHeight: 17,
  },
  askSuccess: {
    fontSize: 12,
    color: '#0A7F3F',
    marginBottom: 4,
  },
  askActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    marginTop: 4,
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE',
  },
  askCancel: {
    fontSize: 14,
    color: '#555',
  },
  askSubmitButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#000',
  },
  askSubmitButtonDisabled: {
    backgroundColor: '#999',
  },
  askSubmitText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
