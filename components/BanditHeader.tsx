import { Database } from '@/lib/database.types';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import BanditMiniMapPreview from '@/components/BanditMiniMapPreview';
import LocalBanditOctopusIcon from '@/components/LocalBanditOctopusIcon';
import { picsumPlaceImage } from '@/lib/placePhoto';
import TagChip from '@/components/TagChip';
import { TAG_EMOJI_MAP } from './../constants/tagNameToEmoji';
import EventCategories from './EventCategories';
import { ThemedText } from './ThemedText';

type Bandit = Database['public']['Tables']['bandit']['Row'];

interface EventCategory {
  genre: 'Food' | 'Culture' | 'Nightlife' | 'Shopping' | 'Coffee';
  count: number;
}

interface BanditHeaderProps {
  bandit: Bandit;
  categories: EventCategory[];
  onLike?: (id: string, currentLikeStatus: boolean) => void;
  variant?: 'list' | 'detail';
  showActionButtons?: boolean;
  onCategoryPress?: (genre: string) => void;
}

export default function BanditHeader({
  bandit,
  categories,
  onLike,
  variant = 'detail',
  showActionButtons = true,
  onCategoryPress,
}: BanditHeaderProps) {
  const {
    id,
    name,
    family_name,
    age,
    occupation,
    image_url,
    face_image_url,
    rating,
    is_liked,
    bandit_tags,
  } = bandit as any;

  const [imageAspectRatio, setImageAspectRatio] = useState<number>(1);
  const [heroUriIndex, setHeroUriIndex] = useState(0);
  const [useLocalFallback, setUseLocalFallback] = useState(false);

  const isListVariant = variant === 'list';
  const heroCandidates = useMemo(() => {
    const raw = [isListVariant ? face_image_url || image_url : image_url, face_image_url, image_url];
    const out: string[] = [];
    for (const u of raw) {
      const t = typeof u === 'string' ? u.trim() : '';
      if (t && /^https?:\/\//i.test(t) && !out.includes(t)) out.push(t);
    }
    return out;
  }, [isListVariant, face_image_url, image_url]);

  const heroUri =
    heroUriIndex < heroCandidates.length
      ? heroCandidates[heroUriIndex]
      : picsumPlaceImage(`banDit-${id}`, 800, 600);

  useEffect(() => {
    setHeroUriIndex(0);
    setUseLocalFallback(false);
  }, [id, isListVariant, face_image_url, image_url]);

  const imageHeight = isListVariant ? 238 : undefined;
  const containerPadding = isListVariant ? 0 : 16;

  const goFocusHome = () => {
    router.push(`/bandits?focusBanditId=${encodeURIComponent(id)}` as any);
  };

  const heroBlock = (
    <View
      style={[
        styles.imageContainer,
        isListVariant && styles.listImageContainer,
      ]}
    >
      <Image
        source={
          useLocalFallback
            ? require('@/assets/images/play-theatrou.png')
            : { uri: heroUri }
        }
        style={[
          styles.mainImage,
          isListVariant
            ? { height: imageHeight }
            : { aspectRatio: imageAspectRatio },
          isListVariant && styles.listImage,
        ]}
        onLoad={() => {
          if (!isListVariant) {
            setImageAspectRatio(0.8);
          }
        }}
        onError={() => {
          if (heroUriIndex < heroCandidates.length) {
            setHeroUriIndex((i) => i + 1);
            return;
          }
          setUseLocalFallback(true);
        }}
      />

      {isListVariant && (
        <Pressable style={styles.heroTapArea} onPress={goFocusHome} accessibilityRole="button" />
      )}

      {showActionButtons && (
        <>
          <Pressable
            style={styles.exploreButton}
            onPress={() => router.push(`/cityGuide?banditId=${id}`)}
          >
            <Text style={styles.plusSign}>+</Text>
            <Text style={styles.exploreText}>CITY GUIDE</Text>
          </Pressable>

          {isListVariant ? (
            <View style={styles.mapMiniWrap} pointerEvents="box-none">
              <BanditMiniMapPreview banditId={id} />
            </View>
          ) : (
            <Pressable
              style={styles.mapButtonTopRight}
              onPress={() => router.push(`/cityMap?banditId=${id}`)}
            >
              <Image
                source={require('@/assets/icons/Alecive-Flatwoken-Apps-Google-Maps.512.png')}
                style={styles.mapIcon}
              />
            </Pressable>
          )}
        </>
      )}
    </View>
  );

  const infoBlock = (
    <>
      <View
        style={[
          styles.infoContainer,
          isListVariant && styles.listInfoContainer,
        ]}
      >
        <View style={styles.nameContainer}>
          <View style={styles.nameRow}>
            <View style={styles.octopusWrap}>
              <LocalBanditOctopusIcon />
            </View>
            <Text style={styles.name}>{`${name} ${family_name}`}</Text>
          </View>
          <Text style={styles.descriptionLine}>
            {`(${age} y/o, local banDit)`}
          </Text>
          <Text style={styles.occupation}>{occupation}</Text>
          {isListVariant && (
            <Pressable
              onPress={() => router.push(`/bandit/${id}` as any)}
              hitSlop={6}
            >
              <Text style={styles.openProfileCue}>Open profile</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.ratingContainer}>
          {!isListVariant && (
            <>
              <ThemedText style={styles.stars}>⭐️</ThemedText>
              <ThemedText style={styles.rating}>{rating}</ThemedText>
            </>
          )}
          {onLike && (
            <Pressable onPress={() => onLike(id, is_liked)} style={styles.followButton}>
              <Text style={styles.followButtonText}>{is_liked ? 'Following' : 'Follow'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={isListVariant ? styles.listCategoriesWrapper : undefined}>
        <EventCategories
          categories={categories}
          onCategoryPress={onCategoryPress}
        />

        {bandit_tags?.length > 0 && (
          <View style={styles.vibesContainer}>
            {bandit_tags.map((bt: any) => {
              const tagName = bt.tags?.name;
              if (!tagName) return null;

              return (
                <TagChip
                  key={tagName}
                  label={`${TAG_EMOJI_MAP[tagName] ?? ''} ${tagName}`}
                />
              );
            })}
          </View>
        )}
      </View>
    </>
  );

  return (
    <View
      style={[
        styles.container,
        { paddingHorizontal: containerPadding },
        isListVariant && styles.listContainer,
      ]}
    >
      {isListVariant ? (
        <View style={styles.touchableContainer}>
          {heroBlock}
          <Pressable
            onPress={goFocusHome}
            style={({ pressed }) => [styles.listBodyPressable, pressed && { opacity: 0.97 }]}
          >
            {infoBlock}
          </Pressable>
        </View>
      ) : (
        <>
          {heroBlock}
          {infoBlock}
        </>
      )}
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
  },
  listContainer: {
    borderRadius: 20,
    marginVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  touchableContainer: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  listBodyPressable: {
    backgroundColor: '#FFFFFF',
  },
  heroTapArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  mapMiniWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    elevation: 8,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 32,
    position: 'relative',
    zIndex: 1,
  },
  listImageContainer: {
    marginBottom: 0,
  },
  mainImage: {
    width: '100%',
    borderRadius: 20,
  },
  listImage: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  exploreButton: {
    position: 'absolute',
    right: 16,
    bottom: -12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 4,
    elevation: 6,
    zIndex: 10,
  },
  mapButtonTopRight: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  mapIcon: {
    width: 47,
    height: 47,
  },
  exploreText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  plusSign: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 2,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  listInfoContainer: {
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 0,
  },
  listCategoriesWrapper: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  nameContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  octopusWrap: {
    flexShrink: 0,
  },
  openProfileCue: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#0a7ea4',
  },
  name: {
    fontWeight: '700',
    fontSize: 17,
    color: '#222',
    marginBottom: 4,
  },
  descriptionLine: {
    fontSize: 12,
    color: '#3C3C3C',
    marginBottom: 4,
  },
  occupation: {
    fontWeight: '600',
    fontSize: 13,
    color: '#3C3C3C',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stars: {
    fontSize: 16,
  },
  rating: {
    fontSize: 14,
    fontWeight: '700',
  },
  followButton: {
    marginLeft: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#111',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  vibesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    marginBottom: 14,
  },
});
