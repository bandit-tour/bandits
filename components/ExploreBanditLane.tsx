/**
 * EXPLORE — Bandit-first discovery lane.
 * Full-bleed portrait stories · not a dashboard tile strip.
 * Trust signal = Octopus Verified™ only (never Passport).
 */

import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { getBanditsWithTags } from '@/app/services/bandits';
import LocalBanditOctopusIcon from '@/components/LocalBanditOctopusIcon';
import { Database } from '@/lib/database.types';
import { color, firstNameOf, shortIntro, space } from '@/lib/guestDesign';
import { fetchBanditPremiumVisibility } from '@/lib/guest-app/premium-visibility';

const LOCAL_FALLBACK = require('@/assets/images/play_athens_bg.png');

type Bandit = Database['public']['Tables']['bandit']['Row'] & {
  bandit_tags?: { tags: { id: string; name: string } | null }[] | null;
};

function portraitUri(b: Bandit): string | null {
  for (const u of [b.image_url, b.face_image_url]) {
    const t = String(u || '').trim();
    if (t.startsWith('http://') || t.startsWith('https://')) return t;
  }
  return null;
}

function placeLine(b: Bandit): string {
  const occ = String(b.occupation || '').trim();
  if (occ) return occ;
  const tags = (b.bandit_tags || [])
    .map((t) => t.tags?.name)
    .filter(Boolean)
    .slice(0, 2) as string[];
  if (tags.length) return tags.join(' · ');
  return 'Athens · Local banDit';
}

type Props = {
  onMeet: (banditId: string) => void;
  onSeeAll?: () => void;
};

export default function ExploreBanditLane({ onMeet, onSeeAll }: Props) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(width - 40, 340);
  const [bandits, setBandits] = useState<Bandit[]>([]);
  const [loading, setLoading] = useState(true);
  const [octopusById, setOctopusById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = (await getBanditsWithTags().catch(() => [])) as Bandit[];
        if (cancelled) return;
        const slice = list.slice(0, 8);
        setBandits(slice);
        const vis = await Promise.all(
          slice.map(async (b) => {
            const v = await fetchBanditPremiumVisibility(String(b.id));
            return [b.id, v?.octopusVerified === true] as const;
          }),
        );
        if (!cancelled) {
          const map: Record<string, boolean> = {};
          for (const [id, ok] of vis) map[id] = ok;
          setOctopusById(map);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lead = useMemo(
    () => (bandits[0] ? firstNameOf(bandits[0].name) : 'a Local banDit'),
    [bandits],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Meet the city through people</Text>
          <Text style={styles.title}>Local banDits</Text>
          <Text style={styles.lead}>
            {`Start with ${lead} — stories, places, and nights ${lead} actually lives.`}
          </Text>
        </View>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={10} accessibilityRole="button">
            <Text style={styles.seeAll}>All</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={color.brand} style={{ marginVertical: 28 }} />
      ) : (
        <ScrollView
          horizontal
          pagingEnabled={false}
          decelerationRate="fast"
          snapToInterval={cardW + 14}
          snapToAlignment="start"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.lane}
        >
          {bandits.map((b) => {
            const first = firstNameOf(b.name);
            const uri = portraitUri(b);
            const line =
              shortIntro(b.description, 110) ||
              shortIntro(b.why_follow, 110) ||
              'Shows you the side of the city locals don’t usually share.';
            const verified = octopusById[b.id] === true;
            return (
              <Pressable
                key={b.id}
                style={({ pressed }) => [
                  styles.poster,
                  { width: cardW },
                  pressed && styles.pressed,
                ]}
                onPress={() => onMeet(b.id)}
                accessibilityRole="button"
                accessibilityLabel={`Meet ${first}`}
              >
                <ExpoImage
                  source={uri ? { uri } : LOCAL_FALLBACK}
                  style={styles.photo}
                  contentFit="cover"
                  contentPosition={{ top: 0, left: '50%' }}
                  transition={200}
                  cachePolicy="memory-disk"
                />
                <View style={styles.scrim} />
                <View style={styles.copy}>
                  {verified ? (
                    <View style={styles.verifiedRow}>
                      <LocalBanditOctopusIcon style={styles.verifiedIcon} />
                      <Text style={styles.verifiedText}>Octopus Verified™</Text>
                    </View>
                  ) : null}
                  <Text style={styles.name} numberOfLines={1}>
                    {String(b.name || '').trim()}
                  </Text>
                  <Text style={styles.place} numberOfLines={1}>
                    {placeLine(b)}
                  </Text>
                  <Text style={styles.sentence} numberOfLines={2}>
                    {line}
                  </Text>
                  <View style={styles.meetPill}>
                    <Text style={styles.meetText}>{`Meet ${first}`}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: space.md,
    paddingBottom: space.sm,
    backgroundColor: color.ink,
  },
  head: {
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: space.md,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  title: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Caros',
  },
  lead: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.72)',
    maxWidth: 280,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '700',
    color: color.brand,
    marginTop: 8,
  },
  lane: {
    paddingHorizontal: space.lg,
    gap: 14,
    paddingBottom: space.md,
  },
  poster: {
    aspectRatio: 3 / 4,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0A0A0A',
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // layered atmosphere — not a flat card
    borderBottomWidth: 0,
  },
  copy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    paddingTop: 72,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  verifiedIcon: { width: 18, height: 18, borderRadius: 4 },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.9)',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Caros',
  },
  place: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  sentence: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.88)',
  },
  meetPill: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: color.brand,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  meetText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
});
