/**
 * HOME = trip brain (ACCESS) — NOT a Bandit profile surrogate.
 *
 * Progressive hierarchy on one scroll:
 * 1. Destination / hotel context
 * 2. Primary Local Bandit hero (emotional lead — one Meet CTA)
 * 3. Today / what’s next
 * 4. Hotel signals
 * 5. Safety / bandiTEAM
 * 6. Premium Insights (eligible only)
 * 7. Local Friend
 * 8. Next journey actions
 * 9. Discovery entry points (Explore worlds)
 *
 * Passport stays under Impact / More. Octopus Verified™ only when eligible.
 */

import { Image as ExpoImage } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import ExploreBanditLane from '@/components/ExploreBanditLane';
import LocalBanditOctopusIcon from '@/components/LocalBanditOctopusIcon';
import { useCity } from '@/contexts/CityContext';
import { Database } from '@/lib/database.types';
import { color, firstNameOf, shortIntro, space } from '@/lib/guestDesign';
import {
  fetchBanditPremiumVisibility,
  type BanditPremiumVisibility,
} from '@/lib/guest-app/premium-visibility';
import { useGuestLifecycle } from '@/lib/guest-lifecycle/useGuestLifecycle';
import { liveHotelDisplayName } from '@/lib/stay/liveHotelIdentity';
import { ensureAnonymousSession, getHotelEntry, type HotelEntry } from '@/lib/pilotSession';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { bottleIsPrimaryInvite, bottlePrimaryInviteCopy } from '@/lib/upperTab';

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
  return 'Athens · Local banDit';
}

type SectionRowProps = {
  title: string;
  sub: string;
  onPress: () => void;
  accent?: string;
  testLabel?: string;
};

function SectionRow({ title, sub, onPress, accent = color.brand, testLabel }: SectionRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={testLabel || title}
    >
      <View style={[styles.rowAccent, { backgroundColor: accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

export default function TripHomeScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { selectedCity } = useCity();
  const { isAfterTrip, state: lifeState, activeStay, isFullStay, refresh } = useGuestLifecycle();
  const [hotel, setHotel] = useState<HotelEntry | null>(null);
  const [bandits, setBandits] = useState<Bandit[]>([]);
  const [loadingBandits, setLoadingBandits] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [premiumVis, setPremiumVis] = useState<BanditPremiumVisibility | null>(null);

  const load = useCallback(async () => {
    try {
      await ensureAnonymousSession().catch(() => undefined);
      const [entry, list] = await Promise.all([
        getHotelEntry().catch(() => null),
        getBanditsWithTags().catch((e) => {
          console.warn('[TripHome] bandits load failed', e);
          return [];
        }),
      ]);
      setHotel(entry);
      const rows = (list || []) as Bandit[];
      setBandits(rows);
      const featured = rows[0];
      if (featured) {
        const v = await fetchBanditPremiumVisibility(String(featured.id));
        setPremiumVis(v);
      } else {
        setPremiumVis(null);
      }
    } finally {
      setLoadingBandits(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), load()]);
    } finally {
      setRefreshing(false);
    }
  }, [load, refresh]);

  const refreshControl = usePremiumRefreshControl(refreshing, () => {
    void onRefresh();
  });

  const city = selectedCity || 'Athens';
  const hotelName =
    liveHotelDisplayName({
      stayName: activeStay?.hotelName,
      entry: hotel,
      slug: activeStay?.hotelSlug || hotel?.slug,
    }) || city;
  const roomLabel = activeStay?.roomNumber ? `Room ${activeStay.roomNumber}` : null;
  const featured = bandits[0] ?? null;
  const first = featured ? firstNameOf(featured.name) : 'a Local banDit';
  const showOctopus = premiumVis?.octopusVerified === true;
  const showPremium = premiumVis?.showPremiumInsights === true;
  /** Hero leads emotionally — keep short so shell + Local banDits stay in first scroll. */
  const heroH = Math.max(280, Math.min(height * 0.38, 360));

  const stayContextLine = useMemo(() => {
    if (isAfterTrip) return 'Between trips · city memory open';
    if (isFullStay && roomLabel) return `${hotelName} · ${roomLabel}`;
    if (isFullStay) return `Stay active · ${hotelName}`;
    if (activeStay) return `Connected · ${hotelName}`;
    return `${city} · guest access`;
  }, [isAfterTrip, isFullStay, roomLabel, hotelName, activeStay, city]);

  const lifeLabel = useMemo(() => {
    switch (lifeState) {
      case 'ACTIVE_STAY':
      case 'REACTIVATED':
        return 'During stay';
      case 'AFTER_TRIP':
        return 'After trip';
      case 'NEXT_TRIP_PLANNING':
        return 'Planning next';
      default:
        return 'Before trip';
    }
  }, [lifeState]);

  /**
   * P0: Home must NEVER trap in Between Trips (full AfterTripHome).
   * Between Trips lives on Hotel tab; Home stays trip brain with a soft CTA.
   */
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 64 }}
      refreshControl={refreshControl}
      testID="trip-home-scroll"
    >
      {isAfterTrip ? (
        <View style={styles.betweenTripsBanner} testID="home-between-trips-banner">
          <Text style={styles.betweenTripsKicker}>Between trips</Text>
          <Text style={styles.betweenTripsTitle}>Keep discovering</Text>
          <View style={styles.betweenTripsRow}>
            <Pressable
              style={({ pressed }) => [styles.betweenTripsBtn, pressed && styles.pressed]}
              onPress={() => router.push('/cityMemory' as Href)}
              accessibilityRole="button"
              accessibilityLabel="Open City Memory"
            >
              <Text style={styles.betweenTripsBtnText}>City Memory</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.betweenTripsBtnGhost, pressed && styles.pressed]}
              onPress={() => router.push('/reactivateStay' as Href)}
              accessibilityRole="button"
              accessibilityLabel="Connect My New Stay"
            >
              <Text style={styles.betweenTripsBtnGhostText}>Connect stay</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* 1 — Destination / stay context (brand lives in GuestChromeBar) */}
      <View style={styles.contextBar} testID="home-destination-context">
        <View style={styles.contextLeft}>
          <Text style={styles.contextKicker}>Destination</Text>
          <Text style={styles.contextCity} numberOfLines={1}>
            {city}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.hotelChip, pressed && styles.pressed]}
          onPress={() => router.push('/hotelier' as Href)}
          accessibilityRole="button"
          accessibilityLabel="Open hotel stay"
        >
          <Text style={styles.hotelChipEyebrow}>{lifeLabel}</Text>
          <Text style={styles.hotelChipName} numberOfLines={1}>
            {hotelName}
          </Text>
          <Text style={styles.hotelChipMeta} numberOfLines={1}>
            {stayContextLine}
          </Text>
        </Pressable>
      </View>

      {/* 2 — Featured Local banDit hero (emotional lead — not the whole Home) */}
      <View style={[styles.hero, { height: heroH }]} testID="home-bandit-hero">
        {loadingBandits && !featured ? (
          <View style={styles.heroLoading}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : (
          <>
            <ExpoImage
              source={
                featured && portraitUri(featured)
                  ? { uri: portraitUri(featured)! }
                  : LOCAL_FALLBACK
              }
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              contentPosition={{ top: 0, left: '50%' }}
              transition={220}
              cachePolicy="memory-disk"
            />
            <View style={styles.heroTopGrad} />
            <View style={styles.heroBottomGrad} />
            <View style={styles.heroCopy}>
              {showOctopus ? (
                <View style={styles.verifiedRow}>
                  <LocalBanditOctopusIcon style={styles.verifiedIcon} />
                  <Text style={styles.verifiedText}>Octopus Verified™</Text>
                </View>
              ) : null}
              <Text style={styles.heroEyebrow}>Featured Local banDit · {city}</Text>
              <Text style={styles.heroName} numberOfLines={2}>
                {featured ? String(featured.name || '').trim() : 'Local banDits'}
              </Text>
              <Text style={styles.heroPlace} numberOfLines={1}>
                {featured ? placeLine(featured) : city}
              </Text>
              <Text style={styles.heroLine} numberOfLines={2}>
                {featured
                  ? shortIntro(featured.description, 110) ||
                    shortIntro(featured.why_follow, 110) ||
                    'Shows you the side of the city locals don’t usually share.'
                  : 'Meet the people who live here — then follow their Athens.'}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.primaryCta, pressed && styles.pressed]}
                onPress={() =>
                  featured
                    ? router.push(`/bandit/${featured.id}` as Href)
                    : router.push('/bandits' as Href)
                }
                accessibilityRole="button"
                accessibilityLabel={`Meet ${first}`}
              >
                <Text style={styles.primaryCtaText}>{`Meet ${first}`}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* 3 — Diverse Local banDits (excludes featured hero — one primary Home appearance) */}
      <View testID="home-local-bandits-lane">
        <ExploreBanditLane
          excludeBanditId={featured?.id ? String(featured.id) : null}
          onMeet={(id) => router.push(`/bandit/${encodeURIComponent(id)}` as Href)}
          onSeeAll={() => router.push('/bandits' as Href)}
        />
      </View>

      {/* 4 — Today / what’s next (no duplicate City Guide / routes for featured banDit) */}
      <View style={styles.section} testID="home-today">
        <Text style={styles.sectionKicker}>Today</Text>
        <Text style={styles.sectionTitle}>What’s next</Text>
        <SectionRow
          title="Explore places"
          sub="Cafés, food, nightlife and shops near you"
          onPress={() => router.push('/explore' as Href)}
        />
        <SectionRow
          title="Book with a host"
          sub="Experiences · real faces · tonight"
          accent="#2A2A2A"
          onPress={() => router.push('/experiences' as Href)}
        />
      </View>

      {/* 5 — Stay (single compact entry — no jargon) */}
      <View style={[styles.section, styles.sectionAlt]} testID="home-hotel-signals">
        <Text style={styles.sectionKicker}>Stay</Text>
        <SectionRow
          title={hotelName}
          sub={isFullStay ? `${roomLabel || 'Your room'} · hotel services` : 'Connect a stay when you’re ready'}
          accent="#1A3A4A"
          onPress={() =>
            router.push((isFullStay ? '/hotelier' : '/reactivateStay') as Href)
          }
          testLabel="Open hotel"
        />
      </View>

      {/* 6 — Safety / bandiTEAM (preview — does NOT replace top-rail bandiTEAM) */}
      <View style={styles.section} testID="home-safety">
        <Text style={styles.sectionKicker}>bandiTEAM</Text>
        <Text style={styles.sectionTitle}>Traveler safety</Text>
        <SectionRow
          title="Open bandiTEAM"
          sub="Scam alerts · community notices · report unsafe"
          accent="#8B1A1A"
          onPress={() => router.push('/alerts' as Href)}
          testLabel="Open bandiTEAM"
        />
        <SectionRow
          title="Scam alerts"
          sub="Unsafe taxis · tourist traps · community notices"
          accent="#5A1010"
          onPress={() => router.push('/scam-alerts' as Href)}
          testLabel="Open traveler safety alerts"
        />
        <SectionRow
          title="Report something unsafe"
          sub="Help protect the next traveler"
          accent="#5A1010"
          onPress={() => router.push('/bandiTeam/report' as Href)}
        />
      </View>

      {/* 7 — Premium Insights (eligible only) */}
      {showPremium && featured ? (
        <View style={[styles.section, styles.premiumSection]} testID="home-premium">
          <View style={styles.premiumHead}>
            {showOctopus ? (
              <LocalBanditOctopusIcon style={styles.premiumIcon} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionKickerLight}>Octopus Verified™</Text>
              <Text style={styles.sectionTitleLight}>Premium Insights</Text>
            </View>
          </View>
          <Text style={styles.premiumLead}>
            {`${first} can open gated local access — One Request, Stay Pass, paid concierge.`}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.premiumCta, pressed && styles.pressed]}
            onPress={() =>
              router.push(`/premium/${encodeURIComponent(String(featured.id))}` as Href)
            }
            accessibilityRole="button"
            accessibilityLabel={`Open Premium Insights with ${first}`}
          >
            <Text style={styles.premiumCtaText}>{`Open ${first}'s Premium`}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 8 — Local Friend */}
      <View style={[styles.section, styles.sectionAlt]} testID="home-local-friend">
        <Text style={styles.sectionKicker}>People</Text>
        <Text style={styles.sectionTitle}>Local Friend</Text>
        <SectionRow
          title="Meet someone local"
          sub="QR-linked social connection — not SmartTraveler"
          accent="#3A2A4A"
          onPress={() => router.push('/localFriend' as Href)}
          testLabel="Open Local Friend"
        />
      </View>

      {/* 9 — Next journey / Travel in a Bottle (state-aware) */}
      <View
        style={[
          styles.section,
          bottleIsPrimaryInvite({ isFullStay, state: lifeState }) && styles.bottleInvite,
        ]}
        testID="home-journey"
      >
        <Text style={styles.sectionKicker}>
          {bottleIsPrimaryInvite({ isFullStay, state: lifeState })
            ? 'Next trip'
            : 'Later trips'}
        </Text>
        <Text style={styles.sectionTitle}>
          {bottlePrimaryInviteCopy({ isFullStay, state: lifeState }).title}
        </Text>
        {!bottleIsPrimaryInvite({ isFullStay, state: lifeState }) ? (
          <Text style={styles.rowSub}>
            During your stay, Bottle stays in More — focus on tonight. Mix sleeping when you plan the next trip.
          </Text>
        ) : null}
        <SectionRow
          title="Travel in a Bottle"
          sub={bottlePrimaryInviteCopy({ isFullStay, state: lifeState }).sub}
          accent={
            bottleIsPrimaryInvite({ isFullStay, state: lifeState }) ? color.brand : '#4A3A1A'
          }
          onPress={() => router.push('/travelBottle' as Href)}
          testLabel="Open Travel in a Bottle"
        />
      </View>

      {/* 10 — Discovery entry points (ecosystem access — no duplicate Explore identity) */}
      <View style={[styles.section, styles.sectionAlt]} testID="home-discovery">
        <Text style={styles.sectionKicker}>Discover</Text>
        <Text style={styles.sectionTitle}>More to explore</Text>
        <SectionRow
          title="Experiences"
          sub="Book with hosts who live here"
          accent="#2A2A2A"
          onPress={() => router.push('/experiences' as Href)}
        />
        <SectionRow
          title="SmartTraveler"
          sub="Places locals pass to each other"
          accent="#2A3A2A"
          onPress={() => router.push('/smarttraveler' as Href)}
        />
        {!isFullStay ? (
          <SectionRow
            title="Travel in a Bottle"
            sub="Mix sleeping experiences for the next trip"
            accent="#3A2A1A"
            onPress={() => router.push('/travelBottle' as Href)}
          />
        ) : null}
        <SectionRow
          title="banDiShop"
          sub="Cool things near me · real local pickup"
          accent="#2A2A3A"
          onPress={() => router.push('/shop' as Href)}
        />
        <SectionRow
          title="Open Explore"
          sub="All discovery worlds in one place"
          accent={color.brand}
          onPress={() => router.push('/explore' as Href)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0B0B' },
  betweenTripsBanner: {
    marginHorizontal: space.lg,
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#1A1814',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(240,215,160,0.35)',
    gap: 8,
  },
  betweenTripsKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(240,215,160,0.9)',
  },
  betweenTripsTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  betweenTripsLead: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.7)' },
  betweenTripsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  betweenTripsBtn: {
    backgroundColor: color.brand,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  betweenTripsBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  betweenTripsBtnGhost: {
    borderWidth: 1,
    borderColor: 'rgba(240,215,160,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  betweenTripsBtnGhostText: { color: '#F0D7A0', fontWeight: '700', fontSize: 13 },
  contextBar: {
    backgroundColor: '#0B0B0B',
    paddingHorizontal: space.lg,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  contextLeft: { flexShrink: 1, minWidth: 0 },
  contextKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
  },
  contextCity: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Caros',
  },
  hotelChip: {
    maxWidth: '58%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hotelChipEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: color.brand,
  },
  hotelChipName: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  hotelChipMeta: {
    marginTop: 2,
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
  },
  hero: {
    width: '100%',
    backgroundColor: '#0B0B0B',
    overflow: 'hidden',
  },
  heroLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTopGrad: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroBottomGrad: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '62%',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  heroCopy: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.lg,
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
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.92)',
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: color.brand,
  },
  heroName: {
    marginTop: 4,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Caros',
  },
  heroPlace: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  heroLine: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.9)',
  },
  primaryCta: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: color.brand,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  section: {
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  sectionAlt: {
    backgroundColor: color.surfaceWarm,
  },
  bottleInvite: {
    backgroundColor: '#FFF8F0',
    borderTopWidth: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.brand,
    borderBottomColor: color.hairline,
  },
  sectionKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: color.muted,
  },
  sectionTitle: {
    marginTop: 4,
    marginBottom: space.sm,
    fontSize: 22,
    fontWeight: '800',
    color: color.ink,
    fontFamily: 'Caros',
  },
  sectionKickerLight: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  sectionTitleLight: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Caros',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  rowAccent: {
    width: 4,
    height: 34,
    borderRadius: 2,
    backgroundColor: color.brand,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: color.ink,
  },
  rowSub: {
    marginTop: 2,
    fontSize: 13,
    color: color.muted,
  },
  chev: { fontSize: 22, color: color.muted },
  premiumSection: {
    backgroundColor: color.octopusDeep,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.octopusBorder,
  },
  premiumHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  premiumIcon: { width: 28, height: 28, borderRadius: 6 },
  premiumLead: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 14,
  },
  premiumCta: {
    alignSelf: 'flex-start',
    backgroundColor: color.brand,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    marginBottom: 6,
  },
  premiumCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
});
