import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { getBanditById, getBanditTags, submitBanditQuestion } from '@/app/services/bandits';
import { getBanditEventCategories, getEvents } from '@/app/services/events';
import { getBanditReviews } from '@/app/services/reviews';

import BanditHeader from '@/components/BanditHeader';
import ReviewCard from '@/components/ReviewCard';
import TagChip from '@/components/TagChip';

import { TAG_EMOJI_MAP } from '@/constants/tagNameToEmoji';
import { Database } from '@/lib/database.types';

type Bandit = Database['public']['Tables']['bandit']['Row'];
type Event = Database['public']['Tables']['event']['Row'];

type DisplayReview = {
  user_id: string;
  review: string;
  rating: number;
  created_at?: string;
  user_name: string;
};

const SAMPLE_BANDIT_REVIEWS: DisplayReview[] = [
  {
    user_id: 'sample-1',
    user_name: 'neo_from_ilisia',
    review: 'Felt like hanging with a plugged‑in local, not a tour guide.',
    rating: 5,
  },
  {
    user_id: 'sample-2',
    user_name: 'athens_after_midnight',
    review: 'Showed us tiny bars we’d never find on Maps.',
    rating: 5,
  },
  {
    user_id: 'sample-3',
    user_name: 'slow_morning_club',
    review: 'Coffee route was spot on – zero influencer traps.',
    rating: 4,
  },
];

interface EventCategory {
  genre: 'Food' | 'Culture' | 'Nightlife' | 'Shopping' | 'Coffee';
  count: number;
}

export default function BanditScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [bandit, setBandit] = useState<Bandit | null>(null);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [reviews, setReviews] = useState<DisplayReview[]>([]);
  const [guideEvents, setGuideEvents] = useState<Event[]>([]);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [askOpen, setAskOpen] = useState(false);
  const [askText, setAskText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchBanditData = async () => {
      try {
        setLoading(true);

        // Bandit
        const banditData = await getBanditById(id as string);
        if (!banditData) throw new Error('Bandit not found');
        setBandit(banditData);

        // Categories (what they recommend)
        try {
          const categoriesData = await getBanditEventCategories(id as string);
          setCategories(categoriesData);
        } catch {
          setCategories([]);
        }

        // Vibes (how it feels)
        try {
          const tagData = await getBanditTags(id as string);
          setTags(tagData);
        } catch {
          setTags([]);
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
          setReviews(limited.length > 0 ? limited : SAMPLE_BANDIT_REVIEWS.slice(0, 3));
        } catch {
          setReviews(SAMPLE_BANDIT_REVIEWS.slice(0, 3));
        }

        // City guide preview (events for this bandit)
        try {
          setGuideLoading(true);
          const eventsForBandit = await getEvents({ banditId: id as string });
          setGuideEvents(eventsForBandit.slice(0, 5));
          setGuideError(null);
        } catch {
          setGuideEvents([]);
          setGuideError(null);
        } finally {
          setGuideLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch bandit');
      } finally {
        setLoading(false);
      }
    };

    fetchBanditData();
  }, [id]);

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
        <Text style={styles.errorText}>{error ?? 'Bandit not found'}</Text>
      </View>
    );
  }

  const handleCategoryPress = (genre: string) => {
    router.push(`/cityGuide?banditId=${id}&genre=${genre}`);
  };

  const handleVibePress = (tag: string) => {
    router.push(`/cityGuide?vibe=${encodeURIComponent(tag)}`);
  };

  const handleAskMePress = () => {
    setAskOpen(true);
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const handleAskSubmit = async () => {
    if (!askText.trim() || !id) return;
    try {
      setSubmitting(true);
      setSubmitError(null);
      await submitBanditQuestion(id as string, askText.trim());
      setSubmitSuccess(true);
      setAskText('');
    } catch {
      setSubmitError('Could not send your question. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '' }} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        {/* HEADER + CATEGORIES */}
        <BanditHeader
          bandit={bandit}
          categories={categories}
          variant="detail"
          showActionButtons
          onCategoryPress={handleCategoryPress}
        />

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

        {bandit.why_follow && (
          <Text style={styles.why_follow}>
            {bandit.why_follow
              .split('.')
              .filter((s) => s.trim())
              .map((sentence, i) => (
                <Text key={i}>{`\n• ${sentence.trim()}.`}</Text>
              ))}
          </Text>
        )}

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

        {/* CITY GUIDE PREVIEW */}
        {guideEvents.length > 0 && (
          <View style={styles.guideSection}>
            <Text style={styles.reviewsTitle}>
              {`City guide by ${bandit.name}`}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.guideEventsContainer}
            >
              {guideEvents.map((event) => (
                <Pressable
                  key={event.id}
                  style={styles.guideCard}
                  onPress={() =>
                    router.push(
                      `/event/${event.id}?banditId=${bandit.id}` as any
                    )
                  }
                >
                  <Text style={styles.guideEventName}>{event.name}</Text>
                  <Text style={styles.guideEventMeta}>
                    {event.genre} · {event.neighborhood}
                  </Text>
                  <Text
                    numberOfLines={3}
                    style={styles.guideEventDescription}
                  >
                    {event.description}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* CTA */}
        <Pressable style={styles.askMeButton} onPress={handleAskMePress}>
          <Text style={styles.askMeText}>Ask me</Text>
        </Pressable>
      </ScrollView>

      {/* ASK ME PANEL */}
      {askOpen && (
        <View style={styles.askOverlay}>
          <View style={styles.askCard}>
            <Text style={styles.askTitle}>{`Ask ${bandit.name}`}</Text>
            <Text style={styles.askSubtitle}>
              Ask anything about the city, spots, or vibes. We’ll route it to the bandiTour team for now.
            </Text>
            <TextInput
              style={styles.askInput}
              multiline
              placeholder="Type your question..."
              value={askText}
              onChangeText={setAskText}
            />
            {submitError && (
              <Text style={styles.askError}>{submitError}</Text>
            )}
            {submitSuccess && (
              <Text style={styles.askSuccess}>
                Thanks, your question was sent. We’ll get back to you soon.
              </Text>
            )}
            <View style={styles.askActions}>
              <TouchableOpacity onPress={() => setAskOpen(false)}>
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
      )}
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
    fontSize: 14,
    color: '#3C3C3C',
    marginLeft: 16,
    marginBottom: 8,
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
  guideSection: {
    marginBottom: 20,
  },
  guideEventsContainer: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  guideCard: {
    width: 220,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
    marginRight: 8,
  },
  guideEventName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  guideEventMeta: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  guideEventDescription: {
    fontSize: 13,
    color: '#3C3C3C',
  },
  askOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  askCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
