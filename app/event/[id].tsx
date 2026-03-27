import React, { useEffect, useState } from 'react';
import { getBanditEventPersonalTip, isEventLiked, toggleEventLike } from '@/app/services/events';
import { ThemedView } from '@/components/ThemedView';
import { Database } from '@/lib/database.types';
import { getCategoryFallbackImage } from '@/lib/placePhoto';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LocalBanditOctopusIcon from '@/components/LocalBanditOctopusIcon';
import {
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

type Event = Database['public']['Tables']['event']['Row'];
type Bandit = Database['public']['Tables']['bandit']['Row'];

const { width: screenWidth } = Dimensions.get('window');

export default function EventDetailScreen() {
  const { id, banditId } = useLocalSearchParams();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [bandit, setBandit] = useState<Bandit | null>(null);
  const [personalTip, setPersonalTip] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setLoading(true);
        
        // Fetch event data
        const { data: eventData, error: eventError } = await supabase
          .from('event')
          .select('*')
          .eq('id', id as string)
          .single();

        if (eventError) throw eventError;
        setEvent(eventData);

        // Fetch bandit data if banditId is provided
        if (banditId) {
          const { data: banditData, error: banditError } = await supabase
            .from('bandit')
            .select('*')
            .eq('id', banditId)
            .single();

          if (!banditError && banditData) {
            setBandit(banditData);

            // Fetch personal tip
            const tip = await getBanditEventPersonalTip(
              Array.isArray(banditId) ? banditId[0] : banditId,
              typeof id === 'string' ? id : id[0]
            );
            setPersonalTip(tip);
          }
        }

        // Check if event is liked by current user
        const eventIdString = typeof id === 'string' ? id : id[0];
        const liked = await isEventLiked(eventIdString);
        setIsLiked(liked);

      } catch (err) {
        console.error('Error fetching event data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [id, banditId]);

  const handleLikePress = async () => {
    try {
      const eventIdString = typeof id === 'string' ? id : id[0];
      await toggleEventLike(eventIdString, isLiked);
      setIsLiked(!isLiked);
    } catch (error) {
      console.error('Error toggling event like:', error);
    }
  };


  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </ThemedView>
    );
  }

  if (!event) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text>Event not found</Text>
        </View>
      </ThemedView>
    );
  }

  // Parse gallery images from comma-separated string
  const galleryImages = event.image_gallery
    ? (event.image_gallery || '').split(',').map(url => url.trim()).filter(url => url)
    : [];

  return (
    <ThemedView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header with like button */}
      <View style={styles.header}>
        <View style={styles.spacer} />
        <TouchableOpacity style={styles.likeButton} onPress={handleLikePress}>
          <Text style={[styles.heartIcon, isLiked && styles.heartIconLiked]}>
            {isLiked ? '❤️' : '🤍'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Main Event Image */}
        <View style={styles.mainImageContainer}>
          <Image
            source={{ 
              uri: event.image_url || getCategoryFallbackImage(event.genre, `event-detail-${event.id}`, 1200, 900)
            }}
            style={styles.mainImage}
            resizeMode="cover"
          />
        </View>

        {/* Event Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.eventTitle}>{event.name || ''}</Text>
        </View>

        {/* Rating */}
        <View style={styles.ratingContainer}>
          <View style={styles.starsContainer}>
            {Array(5).fill(0).map((_, index) => (
              <Text key={index} style={styles.star}>★</Text>
            ))}
          </View>
          <Text style={styles.ratingText}>{(event.rating || 0).toFixed(1)}</Text>
        </View>

        {/* Event Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>{event.description || ''}</Text>
        </View>

        {/* Timing Information */}
        {event.timing_info && event.timing_info.trim() && (
          <View style={styles.timingContainer}>
            <Text style={styles.timingTitle}>Hours</Text>
            <Text style={styles.timingText}>{event.timing_info || ''}</Text>
          </View>
        )}

        {/* Personal Tip Section (only shown if navigated from bandit's city guide) */}
        {bandit && personalTip && (
          <View style={styles.personalTipContainer}>
            <View style={styles.personalTipTitleRow}>
              <LocalBanditOctopusIcon />
              <Text style={styles.personalTipTitle}>{`${bandit.name}'s Personal Tip`}</Text>
            </View>
            <Text style={styles.personalTipText}>{personalTip || ''}</Text>
          </View>
        )}

        {/* Gallery Section */}
        {galleryImages.length > 0 && (
          <View style={styles.galleryContainer}>
            <Text style={styles.galleryTitle}>Gallery</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryScrollContainer}
            >
              {galleryImages.map((imageUrl, index) => (
                <View key={index} style={styles.galleryImageContainer}>
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Bottom spacing to avoid tab bar */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  spacer: {
    width: 40,
  },
  likeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartIcon: {
    fontSize: 20,
  },
  heartIconLiked: {
    color: '#FF0000',
  },
  scrollView: {
    flex: 1,
  },
  mainImageContainer: {
    height: 395,
    width: screenWidth,
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    fontFamily: 'Caros',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 10,
  },
  star: {
    fontSize: 9,
    color: '#FFD700',
    marginRight: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Caros',
  },
  descriptionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#3C3C3C',
    fontFamily: 'Caros',
  },
  timingContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  timingTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#3C3C3C',
    marginBottom: 10,
    fontFamily: 'Caros',
  },
  timingText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#3C3C3C',
    fontFamily: 'Caros',
  },
  personalTipContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  personalTipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  personalTipTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#3C3C3C',
    marginBottom: 0,
    fontFamily: 'Caros',
    flexShrink: 1,
  },
  personalTipText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#3C3C3C',
    fontFamily: 'Caros',
  },
  galleryContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  galleryTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#3C3C3C',
    marginBottom: 15,
    fontFamily: 'Caros',
  },
  galleryScrollContainer: {
    paddingRight: 20,
  },
  galleryImageContainer: {
    width: 109,
    height: 208,
    marginRight: 15,
    borderRadius: 13,
    overflow: 'hidden',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  bottomSpacing: {
    height: 100, // Space to avoid bottom tab bar
  },
}); 