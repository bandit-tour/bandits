import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { getBanditById, getBanditTags, submitBanditQuestion, toggleBanditLike } from '@/app/services/bandits';
import { getBanditEventCategories, getEvents } from '@/app/services/events';
import { formatAskMeModalSubtitle } from '@/lib/askMeMessageFormat';
import { getBanditReviews } from '@/app/services/reviews';
import { supabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { resolveWhyFollowText } from '@/services/whyFollowCopy';
import { getNotificationsBackendStatus } from '@/services/localFriend';

import BanditHeader from '@/components/BanditHeader';
import EventCard from '@/components/EventCard';
import ReviewCard from '@/components/ReviewCard';
import TagChip from '@/components/TagChip';

import { TAG_EMOJI_MAP } from '@/constants/tagNameToEmoji';
import { Database } from '@/lib/database.types';
import { trackEvent } from '@/lib/analytics';

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
  const { id } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;

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
  const askTargetBanditIdRef = useRef<string>('');

  useEffect(() => {
    if (!id) return;

    const fetchBanditData = async () => {
      try {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        const uid = user?.id ?? null;
        setLikeUserId(uid);

        // Bandit
        const banditData = await getBanditById(id as string, uid);
        if (!banditData) throw new Error('banDit not found');
        setBandit(banditData);
        void trackEvent({
          eventName: 'bandit_profile_opened',
          referenceType: 'bandit',
          referenceId: banditData.id,
          onceKey: `bandit_profile_opened:${banditData.id}`,
        });

        // Vibes (how it feels)
        try {
          const tagData = await getBanditTags(id as string);
          setTags(tagData);
        } catch {
          setTags([]);
        }

        // Category chips / counts for inline expansion.
        try {
          const catData = await getBanditEventCategories(id as string);
          setCategories(catData);
        } catch {
          setCategories([]);
        }

        // Reviews (limit to 3–5, fallback to underground-style samples)
        try {
          const raw = await getBanditReviews(id as string);
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
        } catch {
          setReviews(buildFallbackReviews(banditData.id, banditData.name).slice(0, 3));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch bandit');
      } finally {
        setLoading(false);
      }
    };

    fetchBanditData();
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !bandit) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error ?? 'banDit not found'}</Text>
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
      const msg = e instanceof Error ? e.message : '';
      setSubmitError(msg.trim() || 'Could not send your question. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCategoryPress = async (genre: string) => {
    if (!bandit) return;
    // Tap same chip to collapse and keep user on profile.
    if (selectedGenre === genre) {
      setSelectedGenre(null);
      setGenreEvents([]);
      return;
    }
    setSelectedGenre(genre);
    setLoadingGenreEvents(true);
    try {
      const events = await getEvents({ banditId: bandit.id, genre });
      setGenreEvents(events);
    } catch {
      setGenreEvents([]);
    } finally {
      setLoadingGenreEvents(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '', headerBackTitle: 'Back' }} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          isDesktopWeb && styles.contentContainerDesktop,
        ]}
      >
        {/* HEADER + CATEGORIES */}
        <BanditHeader
          bandit={bandit}
          categories={categories}
          selectedGenre={selectedGenre}
          variant="detail"
          showActionButtons
          onCategoryPress={(genre) => {
            void handleCategoryPress(genre);
          }}
          onLike={async (banditId, currentLikeStatus) => {
            setBandit((prev) => (prev ? { ...prev, is_liked: !currentLikeStatus } : prev));
            try {
              await toggleBanditLike(banditId, currentLikeStatus, likeUserId);
            } catch (e) {
              setBandit((prev) => (prev ? { ...prev, is_liked: currentLikeStatus } : prev));
              const msg = e instanceof Error ? e.message : '';
              Alert.alert('Follow unavailable', msg || 'Could not update follow state.');
            }
          }}
        />

        {selectedGenre ? (
          <View style={styles.inlineCategorySection}>
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
            ) : genreEvents.length === 0 ? (
              <Text style={styles.inlineCategoryEmpty}>No spots in this category yet.</Text>
            ) : (
              <View style={styles.inlineCategoryGrid}>
                {genreEvents.map((event) => (
                  <View key={event.id} style={[styles.inlineSpotCardWrap, isDesktopWeb && styles.inlineSpotCardWrapDesktop]}>
                    <EventCard
                      event={event}
                      onLike={() => undefined}
                      isLiked={false}
                      showButton={false}
                      variant="default"
                      showRecommendations
                      banditId={bandit.id}
                      onPress={() =>
                        router.push(`/spot/${event.id}?banditId=${encodeURIComponent(bandit.id)}` as any)
                      }
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        <View style={[styles.profileBodyGrid, isDesktopWeb && styles.profileBodyGridDesktop]}>
          <View style={styles.profileMainCol}>
            {/* VIBES (directly under Categories) */}
            {tags.length > 0 && (
              <View style={styles.vibesSection}>
                <Text style={styles.vibesLabel}>Vibes</Text>
                <ScrollView
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
                </ScrollView>
              </View>
            )}

            {/* DESCRIPTION */}
            <Text style={styles.description}>{bandit.description}</Text>

            {/* WHY FOLLOW */}
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
                    {line.startsWith('•') ? `${line}` : `• ${line}`}
                  </Text>
                ));
              })()}
            </View>
          </View>

          <View style={styles.profileSideCol}>
            {/* REVIEWS */}
            <View style={styles.reviewsSection}>
              <Text style={styles.reviewsTitle}>
                Reviews <Text style={styles.reviewsCount}>({reviews.length})</Text>
              </Text>

              {reviews.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.reviewsContainer}
                >
                  {reviews.map((review, index) => (
                    <ReviewCard key={index} review={review} />
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </View>

        {/* CTA */}
        <Pressable style={styles.askMeButton} onPress={handleAskMePress}>
          <Text style={styles.askMeText}>Ask me</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={askOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setAskOpen(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.askModalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={styles.askOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                Keyboard.dismiss();
                setAskOpen(false);
              }}
              accessibilityLabel="Dismiss"
            />
            <View style={styles.askCard}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.askScrollInner}
              >
                <Text style={styles.askTitle}>{`Ask ${bandit.name}`}</Text>
                <Text style={styles.askSubtitle}>
                  {`Ask anything about the city, spots, or vibes. ${bandit.name} gets your question — you’ll see your message in Chat, and replies there too.`}
                </Text>
                <TextInput
                  style={styles.askInput}
                  multiline
                  placeholder="Type your question..."
                  placeholderTextColor="#999"
                  value={askText}
                  onChangeText={setAskText}
                />
                {submitError && (
                  <Text style={styles.askError}>{submitError}</Text>
                )}
                {!!askNotificationsHint && <Text style={styles.askHint}>{askNotificationsHint}</Text>}
                {submitSuccess && (
                  <Text style={styles.askSuccess}>Your local banDit will reply soon.</Text>
                )}
                <View style={styles.askActions}>
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setAskOpen(false);
                    }}
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
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    marginBottom: 8,
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
    color: '#0a7ea4',
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

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
  },
  askModalRoot: {
    flex: 1,
  },
  askOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  askCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    width: '100%',
    alignSelf: 'center',
    zIndex: 10,
  },
  askScrollInner: {
    paddingBottom: 24,
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
    marginTop: 4,
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
