import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { getUserLikedEvents, toggleEventLike } from '@/app/services/events';
import EventCardSkeleton from '@/components/EventCardSkeleton';
import EventList from '@/components/EventList';
import { useCity } from '@/contexts/CityContext';
import { fetchSWR, invalidateAppDataCache, readCacheStale } from '@/lib/appDataCache';
import { Database } from '@/lib/database.types';

type Event = Database['public']['Tables']['event']['Row'];

const LIKED_EVENTS_CACHE_KEY = 'mySpots:likedEvents:all';
const LIKED_EVENTS_TTL_MS = 60 * 1000;



export default function MySpotsScreen() {
  const mySpotsInitialFocusDoneRef = useRef(false);
  /** Skip one city effect tick after initial load completes (avoid double-fetch vs first focus load). */
  const skipCityRefetchOnceRef = useRef(true);
  // Seed from cache for an instant re-paint on tab switch.
  const cachedAll = useMemo(() => readCacheStale<Event[]>(LIKED_EVENTS_CACHE_KEY), []);
  const [likedEventsAll, setLikedEventsAll] = useState<Event[]>(cachedAll ?? []);
  const [loadedOnce, setLoadedOnce] = useState(cachedAll !== undefined);
  const [refreshing, setRefreshing] = useState(false);
  const { selectedCity } = useCity();

  // Stable Set reference so EventList / EventCard don't see "different"
  // liked-id values on every parent state change.
  const likedEventIds = useMemo(
    () => new Set(likedEventsAll.map((e) => e.id)),
    [likedEventsAll],
  );

  // Client-side city filtering so the cached list can be reused across cities
  // without re-hitting Supabase.
  const filteredEvents = useMemo(
    () =>
      selectedCity
        ? likedEventsAll.filter((event) => event.city === selectedCity)
        : likedEventsAll,
    [selectedCity, likedEventsAll],
  );

  const loadLikedEvents = useCallback((asRefresh: boolean) => {
    if (asRefresh) setRefreshing(true);
    const handle = fetchSWR<Event[]>(
      LIKED_EVENTS_CACHE_KEY,
      LIKED_EVENTS_TTL_MS,
      () => getUserLikedEvents(),
      (events) => {
        setLikedEventsAll(events);
        setLoadedOnce(true);
        setRefreshing(false);
        mySpotsInitialFocusDoneRef.current = true;
      },
      (error) => {
        console.error('Error loading liked events:', error);
        setLoadedOnce(true);
        setRefreshing(false);
        mySpotsInitialFocusDoneRef.current = true;
      },
    );
    return handle;
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const handle = loadLikedEvents(mySpotsInitialFocusDoneRef.current);
      return () => handle.cancel();
    }, [loadLikedEvents]),
  );

  /** City filter changes while mounted no longer require a refetch — filtering is now client-side. */
  useEffect(() => {
    if (!loadedOnce) return;
    if (skipCityRefetchOnceRef.current) {
      skipCityRefetchOnceRef.current = false;
      return;
    }
  }, [selectedCity, loadedOnce]);

  const onRefresh = useCallback(async () => {
    invalidateAppDataCache(LIKED_EVENTS_CACHE_KEY);
    loadLikedEvents(true);
  }, [loadLikedEvents]);

  const handleEventRemove = useCallback(async (eventId: string) => {
    try {
      await toggleEventLike(eventId, true);
      setLikedEventsAll((prev) => prev.filter((event) => event.id !== eventId));
      // Update the cache too so a re-mount doesn't re-add the removed event.
      const cached = readCacheStale<Event[]>(LIKED_EVENTS_CACHE_KEY);
      if (cached) invalidateAppDataCache(LIKED_EVENTS_CACHE_KEY);
    } catch (error) {
      console.error('Error removing event like:', error);
      Alert.alert('Error', 'Failed to remove like');
    }
  }, []);

  if (!loadedOnce) {
    return (
      <View style={styles.mainContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>My Spots</Text>
        </View>
        <View style={{ paddingHorizontal: 12, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <EventCardSkeleton key={i} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>
          My Spots {selectedCity ? `in ${selectedCity}` : ''}
        </Text>
        <Pressable style={styles.refreshBtn} onPress={() => void onRefresh()}>
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </Pressable>
      </View>
      
      <EventList
        events={filteredEvents}
        onEventLike={handleEventRemove}
        likedEventIds={likedEventIds}
        emptyMessage="No liked events yet"
        variant="vertical"
        showRecommendations={true}
        buttonType="remove"
        buttonText="Remove"
        scrollViewStyle={styles.scrollView}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingCaption: {
    marginTop: 12,
    fontSize: 15,
    color: '#555',
    fontWeight: '600',
  },
  headerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 10,
    minHeight: 52,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3C3C3C',
  },
  refreshBtn: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: '#111',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  refreshBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 0,
    gap: 11,
  },

  noEventsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
}); 
