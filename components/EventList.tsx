import { Database } from '@/lib/database.types';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const eventRefs = useRef<{ [key: string]: View | null }>({});

  useImperativeHandle(ref, () => ({
    scrollToEvent: (eventId: string) => {
      if (!scrollViewRef.current) {
        return;
      }

      const eventIndex = events.findIndex(e => e.id === eventId);

      if (eventIndex >= 0) {
        if (isHorizontal) {
          const estimatedCardWidth = 180;
          const estimatedGap = 2;
          const estimatedX = eventIndex * (estimatedCardWidth + estimatedGap);
          scrollViewRef.current.scrollTo({ x: estimatedX, animated: true });
        } else {
          const estimatedCardHeight = 135;
          const estimatedGap = 11;
          const estimatedY = eventIndex * (estimatedCardHeight + estimatedGap);
          scrollViewRef.current.scrollTo({ y: estimatedY, animated: true });
        }
      }
    },
  }));

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

  // Handle empty state
  if (events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const scrollViewProps = isHorizontal
    ? {
        horizontal: true,
        showsHorizontalScrollIndicator: false,
        contentContainerStyle: [styles.horizontalContentContainer, contentContainerStyle]
      }
    : {
        style: [styles.verticalScrollView, scrollViewStyle],
        contentContainerStyle: [styles.verticalContentContainer, contentContainerStyle]
      };

  const refreshControl =
    onRefresh != null ? (
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
    ) : undefined;

  const content = (
    <ScrollView {...scrollViewProps} ref={scrollViewRef} refreshControl={refreshControl}>
      <View style={isHorizontal ? styles.horizontalContainer : styles.verticalContainer}>
        {events.map((event) => (
          <View
            key={event.id}
            ref={(ref) => {
              eventRefs.current[event.id] = ref;
            }}
          >
            <EventCard
              event={event}
              onLike={() => onEventLike?.(event.id)}
              isLiked={likedEventIds.has(event.id)}
              variant={isHorizontal ? 'horizontal' : 'default'}
              showRecommendations={showRecommendations}
              banditId={banditId}
              buttonType={buttonType}
              buttonText={buttonText}
              showButton={showButton}
              imageHeight={imageHeight}
              onPress={onEventPress ? () => onEventPress(event) : undefined}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return content;
});

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
    flexGrow: 1,
  },
  verticalContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 0,
    gap: 11,
  },
  horizontalContentContainer: {
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  horizontalContainer: {
    flexDirection: 'row',
    gap: 2,
  },
});
