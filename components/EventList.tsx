import { Database } from '@/lib/database.types';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildEventListImagePlan } from '@/lib/eventListImagePlan';
import {
  enforceUniqueRecommendationImagesByEventId,
  resolveStrictRecommendationImagesByEventId,
} from '@/lib/recommendationImages';
import EventCard from './EventCard';

type Event = Database['public']['Tables']['event']['Row'];

export interface EventListRef {
  scrollToEvent: (eventId: string) => void;
}

interface EventListProps {
  events: Event[];
  onEventLike?: (eventId: string) => void;
  likedEventIds?: Set<string>;
  emptyMessage?: string;
  variant?: 'vertical' | 'horizontal';
  showRecommendations?: boolean;
  banditId?: string;
  // EventCard specific props
  buttonType?: 'like' | 'remove';
  buttonText?: string;
  showButton?: boolean;
  imageHeight?: number;
  onEventPress?: (event: Event) => void;
  // ScrollView props
  scrollViewStyle?: any;
  contentContainerStyle?: any;
  refreshing?: boolean;
  onRefresh?: () => void;
  // Loading and error states (from EventsList)
  loading?: boolean;
  error?: string | null;
}

const EventList = forwardRef<EventListRef, EventListProps>(({
  events,
  onEventLike,
  likedEventIds = new Set(),
  emptyMessage = 'No events found',
  variant = 'vertical',
  showRecommendations = false,
  banditId,
  buttonType = 'like',
  buttonText,
  showButton = true,
  imageHeight,
  onEventPress,
  scrollViewStyle,
  contentContainerStyle,
  refreshing = false,
  onRefresh,
  loading = false,
  error = null
}, ref) => {
  const isHorizontal = variant === 'horizontal';
  const scrollViewRef = useRef<ScrollView>(null);
  const flatListRef = useRef<FlatList<Event>>(null);
  const eventRefs = useRef<{ [key: string]: View | null }>({});
  const refreshControl = usePremiumRefreshControl(
    refreshing,
    () => {
      onRefresh?.();
    },
    { active: onRefresh != null },
  );
  const listImagePlan = useMemo(() => buildEventListImagePlan(events), [events]);
  const [resolvedRecommendationImageById, setResolvedRecommendationImageById] = useState<Record<string, string>>({});
  const [recoHeroReady, setRecoHeroReady] = useState(true);

  useEffect(() => {
    if (!showRecommendations || events.length === 0) {
      setResolvedRecommendationImageById({});
      setRecoHeroReady(true);
      return;
    }
    let cancelled = false;
    setRecoHeroReady(false);
    void (async () => {
      const out = await resolveStrictRecommendationImagesByEventId(events);
      const uniqueOut = enforceUniqueRecommendationImagesByEventId(events, out);
      if (!cancelled) {
        setResolvedRecommendationImageById(uniqueOut);
        setRecoHeroReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showRecommendations, events]);

  useImperativeHandle(ref, () => ({
    scrollToEvent: (eventId: string) => {
      const eventIndex = events.findIndex((e) => e.id === eventId);
      if (eventIndex < 0) return;
      if (isHorizontal) {
        if (!scrollViewRef.current) return;
        const estimatedCardWidth = 180;
        const estimatedGap = 2;
        const estimatedX = eventIndex * (estimatedCardWidth + estimatedGap);
        scrollViewRef.current.scrollTo({ x: estimatedX, animated: true });
      } else {
        if (!flatListRef.current) return;
        flatListRef.current.scrollToIndex({ index: eventIndex, animated: true, viewPosition: 0.1 });
      }
    },
  }));

  // Stable keyExtractor / renderItem for the vertical FlatList path. These
  // capture `likedEventIds`, `resolvedRecommendationImageById`, etc. via
  // closure but use `useCallback` so the references only change when the
  // captured inputs actually change.
  const keyExtractor = useCallback((item: Event) => item.id, []);
  const renderVerticalItem = useCallback(
    ({ item }: { item: Event }) => (
      <View style={styles.verticalCardWrap}>
        <EventCard
          event={item}
          onLike={() => onEventLike?.(item.id)}
          isLiked={likedEventIds.has(item.id)}
          variant="default"
          showRecommendations={showRecommendations}
          banditId={banditId}
          buttonType={buttonType}
          buttonText={buttonText}
          showButton={showButton}
          imageHeight={imageHeight}
          listImageScope={listImagePlan.get(item.id)}
          resolvedRecommendationImageUri={
            showRecommendations ? (resolvedRecommendationImageById[item.id] ?? null) : null
          }
          recommendationHeroResolverReady={showRecommendations ? recoHeroReady : true}
          strictRecommendationImagePolicy={showRecommendations}
          onPress={onEventPress ? () => onEventPress(item) : undefined}
        />
      </View>
    ),
    [
      onEventLike,
      likedEventIds,
      showRecommendations,
      banditId,
      buttonType,
      buttonText,
      showButton,
      imageHeight,
      listImagePlan,
      resolvedRecommendationImageById,
      recoHeroReady,
      onEventPress,
    ],
  );

  // Handle loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  // Handle error state
  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  // Handle empty state (still allow pull-to-refresh when parent wires onRefresh — e.g. My Spots)
  if (events.length === 0) {
    return (
      <ScrollView
        style={styles.emptyScroll}
        contentContainerStyle={styles.emptyScrollContent}
        refreshControl={refreshControl}
      >
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </ScrollView>
    );
  }

  if (isHorizontal) {
    // Horizontal carousel: keep the ScrollView path (counts are usually small
    // and the imperative `scrollToEvent` API depends on it).
    return (
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.horizontalContentContainer, contentContainerStyle]}
        refreshControl={refreshControl}
      >
        <View style={styles.horizontalContainer}>
          {events.map((event) => (
            <View
              key={event.id}
              ref={(refNode) => {
                eventRefs.current[event.id] = refNode;
              }}
            >
              <EventCard
                event={event}
                onLike={() => onEventLike?.(event.id)}
                isLiked={likedEventIds.has(event.id)}
                variant="horizontal"
                showRecommendations={showRecommendations}
                banditId={banditId}
                buttonType={buttonType}
                buttonText={buttonText}
                showButton={showButton}
                imageHeight={imageHeight}
                listImageScope={listImagePlan.get(event.id)}
                resolvedRecommendationImageUri={
                  showRecommendations ? (resolvedRecommendationImageById[event.id] ?? null) : null
                }
                recommendationHeroResolverReady={showRecommendations ? recoHeroReady : true}
                strictRecommendationImagePolicy={showRecommendations}
                onPress={onEventPress ? () => onEventPress(event) : undefined}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  // Vertical lists (e.g. My Spots) can grow unbounded — virtualize so we don't
  // render every card eagerly. Previously this was a ScrollView + .map which
  // rendered every liked event on mount.
  return (
    <FlatList
      ref={flatListRef}
      data={events}
      keyExtractor={keyExtractor}
      renderItem={renderVerticalItem}
      style={[styles.verticalScrollView, scrollViewStyle]}
      contentContainerStyle={[styles.verticalContentContainer, styles.verticalContainerPadding, contentContainerStyle]}
      refreshControl={refreshControl}
      initialNumToRender={6}
      maxToRenderPerBatch={4}
      windowSize={5}
      removeClippedSubviews={Platform.OS !== 'web'}
      ItemSeparatorComponent={VerticalGap}
    />
  );
});

function VerticalGap() {
  return <View style={{ height: 11 }} />;
}

EventList.displayName = 'EventList';

export default EventList;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#ff0000',
    textAlign: 'center',
  },
  emptyScroll: {
    flex: 1,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  verticalScrollView: {
    flex: 1,
  },
  verticalContentContainer: {
    /** Let content shrink-wrap list rows; avoid web flex-expanding rows to viewport height */
    flexGrow: 1,
  },
  verticalContainer: {
    width: '100%',
    maxWidth: '100%',
    paddingHorizontal: 16,
    paddingTop: 0,
    gap: 11,
  },
  verticalContainerPadding: {
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  verticalCardWrap: {
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  horizontalContentContainer: {
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 2,
  },
});
