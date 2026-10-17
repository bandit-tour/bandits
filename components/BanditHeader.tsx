import { Database } from '@/lib/database.types';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import BanditMiniMapPreview from '@/components/BanditMiniMapPreview';
import LocalBanditOctopusIcon from '@/components/LocalBanditOctopusIcon';
import EventCategories from './EventCategories';
import {
  card,
  color,
  displayFollowerCount,
  firstNameOf,
  layout,
  radius,
  shortIntro,
  space,
  type as typo,
} from '@/lib/guestDesign';
import {
  fetchBanditPremiumVisibility,
  type BanditPremiumVisibility,
} from '@/lib/guest-app/premium-visibility';

type Bandit = Database['public']['Tables']['bandit']['Row'];

interface EventCategory {
  genre: 'Food' | 'Culture' | 'Nightlife' | 'Shopping' | 'Coffee';
  count: number;
}

interface BanditHeaderProps {
  bandit: Bandit;
  categories: EventCategory[];
  selectedGenre?: string | null;
  onLike?: (id: string, currentLikeStatus: boolean) => void;
  /** Progressive Meet — opens Ask Me (human first action on profile). */
  onMeet?: () => void;
  variant?: 'list' | 'detail';
  showActionButtons?: boolean;
  onCategoryPress?: (genre: string) => void;
  /** Accordion panel rendered directly under category chips (same scroll surface, no navigation). */
  categoryExpandBelow?: React.ReactNode;
  /** Extra https gallery URIs (e.g. Local picks / spot photos) for Airbnb-style mosaic. */
  galleryExtras?: string[];
  /** When parent already loaded Workspace visibility, reuse it (profile page). */
  premiumVisibility?: BanditPremiumVisibility | null;
}

const LOCAL_FALLBACK = require('@/assets/images/play_athens_bg.png');

function isHttpUri(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const t = value.trim();
  return t.startsWith('https://') || t.startsWith('http://');
}

function pushUnique(out: string[], value: unknown) {
  if (!isHttpUri(value)) return;
  const t = value.trim();
  if (!out.includes(t)) out.push(t);
}

function collectHeroUris(
  isList: boolean,
  face: string | null | undefined,
  image: string | null | undefined,
  extras: string[] | undefined,
): string[] {
  const out: string[] = [];
  // Identity gallery = approved banDit portraits only (image + face).
  // Venue extras are intentionally unused here — product design keeps the carousel
  // as people, not venue mosaic. Venue imagery belongs on Explore / City Guide / spot.
  if (isList) {
    // Prefer full portrait over tight face crop — list cards need head + shoulders.
    pushUnique(out, image);
    pushUnique(out, face);
  } else {
    pushUnique(out, image);
    pushUnique(out, face);
  }
  void extras;
  return out;
}

function BanditHeaderImpl({
  bandit,
  categories,
  selectedGenre,
  onLike,
  onMeet,
  variant = 'detail',
  showActionButtons = true,
  onCategoryPress,
  categoryExpandBelow,
  galleryExtras,
  premiumVisibility,
}: BanditHeaderProps) {
  const {
    id,
    name,
    age,
    occupation,
    image_url,
    face_image_url,
    rating,
    is_liked,
    description,
  } = bandit as any;

  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= layout.desktopBreak;
  /** Match bandits list 2-col breakpoint so portrait ratio tracks grid cells. */
  const isListDesktopGrid = Platform.OS === 'web' && width >= 1100;
  const isListVariant = variant === 'list';

  const [heroUriIndex, setHeroUriIndex] = useState(0);
  const [useLocalFallback, setUseLocalFallback] = useState(false);
  const [galleryPage, setGalleryPage] = useState(0);
  const [failedGalleryUris, setFailedGalleryUris] = useState<Set<string>>(() => new Set());
  const galleryRef = useRef<ScrollView>(null);
  const [premiumVis, setPremiumVis] = useState<BanditPremiumVisibility | null>(null);

  const displayFirstName = firstNameOf(name);
  const identityLine = String(occupation || '').trim() || 'Local banDit';
  const followers = displayFollowerCount(String(id));
  const ratingLabel =
    typeof rating === 'number' && rating > 0 ? rating.toFixed(1) : '—';
  const intro = shortIntro(description, isDesktop ? 180 : 140);
  /** Living status / inspiration — bottle→QR→digital loop voice on the profile. */
  const liveStatus = (() => {
    const why = String((bandit as any).why_follow || '')
      .split('\n')
      .map((l: string) => l.trim().replace(/^•\s*/, ''))
      .find((l: string) => l.length >= 8);
    if (why) return shortIntro(why, 160);
    if (intro) return intro;
    return `${displayFirstName} is out in Athens — follow the rhythm they trust tonight.`;
  })();

  const heroCandidates = useMemo(
    () => collectHeroUris(isListVariant, face_image_url, image_url, galleryExtras),
    [isListVariant, face_image_url, image_url, galleryExtras],
  );

  useEffect(() => {
    setHeroUriIndex(0);
    setUseLocalFallback(false);
    setGalleryPage(0);
    setFailedGalleryUris(new Set());
  }, [id, isListVariant, face_image_url, image_url, galleryExtras]);

  useEffect(() => {
    if (premiumVisibility) {
      setPremiumVis(premiumVisibility);
      return;
    }
    let cancelled = false;
    setPremiumVis(null);
    void fetchBanditPremiumVisibility(String(id)).then((v) => {
      if (!cancelled) setPremiumVis(v);
    });
    return () => {
      cancelled = true;
    };
  }, [id, premiumVisibility]);

  const showPremiumInsights = premiumVis?.showPremiumInsights === true;
  const showOctopusBadge = premiumVis?.octopusVerified === true;
  const octopusIsTestDemo = premiumVis?.authorizationClass === "TEST_DEMO";
  const octopusBadgeLabel = octopusIsTestDemo ? "Octopus Verified™ (TEST)" : "Octopus Verified™";

  /** Valid photos only — drop load failures so carousel count matches visible slides (QA-01/12). */
  const liveGalleryUris = useMemo(
    () => heroCandidates.filter((u) => !failedGalleryUris.has(u)),
    [heroCandidates, failedGalleryUris],
  );

  const markGalleryUriFailed = (uri: string | null | undefined) => {
    if (!uri) return;
    setFailedGalleryUris((prev) => {
      if (prev.has(uri)) return prev;
      const next = new Set(prev);
      next.add(uri);
      return next;
    });
  };

  const advanceHero = () => {
    const live = heroCandidates.filter((u) => !failedGalleryUris.has(u));
    const current = heroCandidates[heroUriIndex];
    if (current) markGalleryUriFailed(current);
    const nextIdx = heroCandidates.findIndex(
      (u, i) => i > heroUriIndex && !failedGalleryUris.has(u) && u !== current,
    );
    if (nextIdx >= 0) {
      setHeroUriIndex(nextIdx);
      return;
    }
    if (live.length <= 1) setUseLocalFallback(true);
  };

  const heroSource = (uri: string | null) =>
    useLocalFallback || !uri ? LOCAL_FALLBACK : { uri };

  const openCityGuide = () => router.push(`/cityGuide?banditId=${id}` as any);
  const openPremiumInsights = () =>
    router.push(`/premium/${encodeURIComponent(String(id))}` as any);
  const openProfile = () => router.push(`/bandit/${id}` as any);
  const openMap = () => router.push(`/cityMap?banditId=${id}` as any);

  /* ---------- LIST — full-bleed story poster (not a dashboard card) ---------- */
  if (isListVariant) {
    const primaryUri = heroCandidates[heroUriIndex] ?? null;
    const listHeroAspect = isListDesktopGrid ? 5 / 4 : 3 / 4;
    const meetLabel = `Meet ${displayFirstName}`;
    const humanSentence =
      intro ||
      shortIntro((bandit as any).why_follow, 140) ||
      'Shows you the side of the city locals don’t usually share.';

    return (
      <View
        style={[
          styles.listCard,
          selectedGenre ? styles.listCardExpanded : null,
          isListDesktopGrid ? styles.listCardDesktop : null,
        ]}
      >
        <Pressable
          style={[styles.listHero, { aspectRatio: listHeroAspect }]}
          onPress={openProfile}
          accessibilityRole="button"
          accessibilityLabel={meetLabel}
        >
          <ExpoImage
            source={heroSource(primaryUri)}
            contentFit="cover"
            contentPosition={{ top: 0, left: '50%' }}
            transition={180}
            cachePolicy="memory-disk"
            recyclingKey={`bandit-list:${id}`}
            priority="high"
            style={styles.listHeroImage}
            onError={advanceHero}
          />
          <View style={styles.listScrim} />
          <View style={styles.listOverlay}>
            {showOctopusBadge ? (
              <View style={styles.listVerifiedRow}>
                <LocalBanditOctopusIcon style={styles.verifiedIconSm} />
                <Text style={styles.listVerifiedText}>{octopusBadgeLabel}</Text>
              </View>
            ) : null}
            <Text style={styles.listNameOnPhoto} numberOfLines={1}>
              {String(name || '').trim()}
            </Text>
            <Text style={styles.listIdentityOnPhoto} numberOfLines={1}>
              {identityLine}
            </Text>
            <Text style={styles.listIntroOnPhoto} numberOfLines={2}>
              {humanSentence}
            </Text>
            <View style={styles.meetBtnOnPhoto}>
              <Text style={styles.meetBtnText}>{meetLabel}</Text>
            </View>
          </View>
        </Pressable>

        {categoryExpandBelow ? (
          <View style={styles.categoryExpandBelow} pointerEvents="box-none">
            {categoryExpandBelow}
          </View>
        ) : null}
      </View>
    );
  }

  /* ---------- PROFILE DETAIL — immersive hero ---------- */
  const galleryUris = liveGalleryUris;
  const mainUri = galleryUris[0] ?? null;
  const sideA = galleryUris[1] ?? null;
  const sideB = galleryUris[2] ?? galleryUris[1] ?? null;
  const hasMulti = Boolean(sideA);

  const slideWidth = Math.min(width, layout.contentMax) - (isDesktop ? 48 : 32);

  const renderCoverImage = (uri: string | null, key: string, style: any) => (
    <ExpoImage
      key={key}
      source={heroSource(uri)}
      contentFit="cover"
      contentPosition="center"
      transition={180}
      cachePolicy="memory-disk"
      recyclingKey={`bandit-detail:${id}:${key}`}
      priority="high"
      style={style}
      onError={() => {
        markGalleryUriFailed(uri);
        advanceHero();
      }}
    />
  );

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const w = e.nativeEvent.layoutMeasurement.width || slideWidth;
    const x = e.nativeEvent.contentOffset.x;
    setGalleryPage(Math.round(x / Math.max(w, 1)));
  };

  const identityPanel = (
    <View style={[styles.identityPanel, isDesktop && styles.identityPanelDesktop]}>
      <View style={styles.nameRow}>
        <Text style={[styles.profileName, !isDesktop && styles.profileNameMobile]}>
          {String(name || '').trim()}
        </Text>
        {showOctopusBadge ? (
          <Pressable
            style={styles.verifiedInline}
            onPress={openPremiumInsights}
            accessibilityRole="button"
            accessibilityLabel={`${octopusBadgeLabel} — open Your Local Insider`}
            testID="octopus-verified-badge"
          >
            <LocalBanditOctopusIcon style={styles.verifiedIconSm} />
          </Pressable>
        ) : null}
      </View>

      {showOctopusBadge ? (
        <Pressable
          style={styles.octopusVerifiedRow}
          onPress={openPremiumInsights}
          accessibilityRole="button"
          accessibilityLabel={`${octopusBadgeLabel} — open Your Local Insider`}
          testID="octopus-verified-row"
        >
          <LocalBanditOctopusIcon style={styles.verifiedIconSm} />
          <Text style={styles.octopusVerifiedText}>{octopusBadgeLabel}</Text>
        </Pressable>
      ) : null}

      <Text style={styles.profileIdentity} numberOfLines={2}>
        {identityLine}
      </Text>

      <Text style={styles.profileLocation} numberOfLines={1}>
        Athens · Local banDit
      </Text>

      {/* Live status / inspiration — visible on identity, not buried in More */}
      <View
        style={styles.liveStatusCard}
        testID="bandit-live-status"
        accessibilityLabel={`Live status: ${liveStatus}`}
      >
        <Text style={styles.liveStatusKicker}>LIVE · TODAY</Text>
        <Text style={styles.liveStatusQuote} numberOfLines={3}>
          {`“${liveStatus}”`}
        </Text>
      </View>

      {intro && intro !== liveStatus ? (
        <Text style={styles.profileIntro} numberOfLines={isDesktop ? 4 : 3}>
          {intro}
        </Text>
      ) : null}

      {showActionButtons ? (
        <View style={styles.profileActions}>
          {/* Progressive journey — Meet first; Passport is NOT Bandit trust */}
          {onMeet ? (
            <Pressable
              style={({ pressed }: any) => [styles.meetPrimary, pressed && styles.btnPressed]}
              onPress={onMeet}
              accessibilityRole="button"
              accessibilityLabel={`Meet ${displayFirstName}`}
            >
              <Text style={styles.meetPrimaryText}>{`Meet ${displayFirstName}`}</Text>
              <Text style={styles.meetPrimarySub}>{`Ask ${displayFirstName} anything about the city`}</Text>
            </Pressable>
          ) : null}

          {onLike ? (
            <Pressable
              style={({ pressed }: any) => [
                styles.followBtn,
                styles.followBtnWide,
                is_liked && styles.followBtnActive,
                pressed && styles.btnPressed,
              ]}
              onPress={() => onLike(id, is_liked)}
              accessibilityRole="button"
            >
              <Text style={styles.followBtnText}>
                {is_liked ? 'Following' : `Follow ${displayFirstName}`}
              </Text>
            </Pressable>
          ) : null}

          {/* City Guide entry = photo overlay only (owner QA). Compact Routes below. */}
          <Pressable
            style={({ pressed, hovered }: any) => [
              styles.journeyChapter,
              (pressed || hovered) && styles.btnPressed,
            ]}
            onPress={() => router.push(`/vibe/${encodeURIComponent(String(id))}` as any)}
            accessibilityRole="button"
            accessibilityLabel="Routes"
            testID="bandit-routes-entry"
          >
            <Text style={styles.journeyChapterEyebrow}>Routes</Text>
            <Text style={styles.athensBtnText}>{`${displayFirstName}'s route`}</Text>
            <Text style={styles.athensBtnSub}>Photographic stops</Text>
          </Pressable>

          {/* Your Local Insider — eligible only; guest-facing name (not “Premium Insights”). */}
          {showPremiumInsights ? (
            <Pressable
              style={({ pressed, hovered }: any) => [
                styles.conciergeBtn,
                styles.conciergeBtnProfile,
                (pressed || hovered) && styles.conciergePressed,
              ]}
              onPress={openPremiumInsights}
              accessibilityRole="button"
              accessibilityLabel={
                octopusIsTestDemo
                  ? `Your Local Insider TEST · ${displayFirstName}`
                  : `Your Local Insider · ${displayFirstName}`
              }
              testID="bandit-premium-insights-cta"
            >
              <LocalBanditOctopusIcon style={styles.conciergeIcon} />
              <View style={styles.conciergeCopy}>
                <Text style={styles.conciergeEyebrow}>
                  {octopusIsTestDemo ? "YOUR LOCAL INSIDER · TEST" : "YOUR LOCAL INSIDER"}
                </Text>
                <Text style={styles.conciergePrimary} numberOfLines={1}>
                  {`Unlock ${displayFirstName}'s Athens`}
                </Text>
                <Text style={styles.conciergeSecondary} numberOfLines={1}>
                  {octopusIsTestDemo
                    ? `QA TEST_DEMO · not PRODUCTION · ${displayFirstName}`
                    : `Octopus Concierge · ${displayFirstName} handles it`}
                </Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const desktopGallery = (
    <View style={[styles.desktopGallery, hasMulti && styles.desktopGallerySplit]}>
      <View style={[styles.desktopMainShot, !hasMulti && styles.desktopMainShotSolo]}>
        {renderCoverImage(mainUri, 'main', styles.fillImage)}
      </View>
      {hasMulti ? (
        <View style={styles.desktopSideCol}>
          <View style={styles.desktopSideShot}>
            {renderCoverImage(sideA, 'sideA', styles.fillImage)}
          </View>
          <View style={styles.desktopSideShot}>
            {renderCoverImage(sideB, 'sideB', styles.fillImage)}
          </View>
        </View>
      ) : null}
    </View>
  );

  const cityGuidePhotoOverlay = (
    <Pressable
      onPress={openCityGuide}
      style={styles.cityGuideOnPhoto}
      accessibilityRole="button"
      accessibilityLabel={`City Guide map · ${displayFirstName}`}
      testID="bandit-city-guide-on-photo"
      hitSlop={8}
    >
      <View style={styles.cityGuideOnPhotoInner} pointerEvents="none">
        <BanditMiniMapPreview banditId={id} />
        <Text style={styles.cityGuideOnPhotoLabel}>+ City Guide</Text>
      </View>
    </Pressable>
  );

  const mobileGallery = (
    <View style={styles.mobileGalleryWrap}>
      <ScrollView
        ref={galleryRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onGalleryScroll}
        scrollEventThrottle={16}
        style={styles.mobileGalleryScroll}
        decelerationRate="fast"
      >
        {(galleryUris.length > 0 ? galleryUris : ['__fallback__']).map((uri, i) => (
          <View key={`g-${i}`} style={[styles.mobileSlide, { width: slideWidth }]}>
            {uri === '__fallback__'
              ? renderCoverImage(null, `m-fallback`, styles.fillImage)
              : renderCoverImage(uri, `m-${i}`, styles.fillImage)}
          </View>
        ))}
      </ScrollView>
      {galleryUris.length > 1 ? (
        <View style={styles.dots}>
          {galleryUris.map((_, i) => (
            <View
              key={`d-${i}`}
              style={[styles.dot, i === galleryPage && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
      {cityGuidePhotoOverlay}
    </View>
  );

  return (
    <View style={styles.detailRoot}>
      <View style={[styles.detailHero, isDesktop && styles.detailHeroDesktop]}>
        {/* City Guide = corner overlay ON the profile photograph (owner QA). */}
        <View style={[styles.galleryCol, isDesktop && styles.galleryColDesktop]}>
          {isDesktop ? (
            <View style={styles.desktopGalleryHost}>
              {desktopGallery}
              {cityGuidePhotoOverlay}
            </View>
          ) : (
            mobileGallery
          )}
        </View>
        <View style={[styles.identityCol, isDesktop && styles.identityColDesktop]}>
          {identityPanel}
        </View>
      </View>

      <View
        collapsable={false}
        style={
          Platform.OS !== 'web'
            ? styles.nativeDetailCategoriesFrontLayer
            : undefined
        }
      >
        <EventCategories
          categories={categories}
          selectedGenre={selectedGenre ?? undefined}
          onCategoryPress={onCategoryPress}
        />
      </View>

      {categoryExpandBelow ? (
        <View style={styles.categoryExpandBelow} pointerEvents="box-none">
          {categoryExpandBelow}
        </View>
      ) : null}
    </View>
  );
}

const BanditHeader = BanditHeaderImpl;
export default BanditHeader;

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  /* List card */
  listCard: {
    backgroundColor: 'transparent',
    borderRadius: 22,
    marginVertical: space.sm,
    marginHorizontal: space.md,
    overflow: 'hidden',
    flex: 1,
  },
  listCardDesktop: {
    width: '100%',
    alignSelf: 'stretch',
  },
  listCardExpanded: {
    shadowOpacity: 0,
    elevation: 0,
    ...Platform.select({ web: { boxShadow: 'none' } as any, default: {} }),
  },
  listHero: {
    width: '100%',
    backgroundColor: color.imageFallback,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
  },
  listScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  listOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    gap: 4,
  },
  listVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  listVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.92)',
  },
  listNameOnPhoto: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Caros',
  },
  listIdentityOnPhoto: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 2,
  },
  listIntroOnPhoto: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
  },
  meetBtnOnPhoto: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: color.brand,
  },
  meetPrimary: {
    alignSelf: 'stretch',
    paddingVertical: 16,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.brand,
  },
  meetPrimaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Caros',
  },
  meetPrimarySub: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  journeyChapter: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surfaceWarm,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  journeyChapterEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: color.brand,
    marginBottom: 4,
  },
  listHeroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    ...Platform.select({
      web: {
        // Face-safe CSS fallback when expo-image object-position is flaky on web
        objectFit: 'cover',
        objectPosition: 'center top',
      } as any,
      default: {},
    }),
  },
  listHeroTap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  /** Territory map only — top-right; never octopus on the portrait */
  listOnImageChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingTop: space.md,
    paddingRight: space.md,
    paddingLeft: space.md,
  },
  verifiedIconSm: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 0,
  },
  listMapChip: {
    /* BanditMiniMapPreview owns size (~76–84); no scale-down */
  },
  listCtaStack: {
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: 0,
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    position: 'relative',
    zIndex: 1,
    backgroundColor: color.surface,
  },
  listCityGuideBtn: {
    alignSelf: 'flex-start',
  },
  listConciergeBtn: {
    alignSelf: 'stretch',
    borderRadius: radius.pill,
    backgroundColor: color.octopusDeep,
    borderColor: color.octopusBorder,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.28)',
      } as any,
      default: {
        shadowColor: '#111111',
        shadowOpacity: 0.28,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
      },
    }),
  },
  listConciergeIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    marginRight: 0,
  },
  listConciergePrimary: {
    color: color.octopusText,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.35,
    fontFamily: 'Caros',
  },
  listConciergeSecondary: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  listBody: {
    paddingHorizontal: space.md,
    paddingTop: space.sm + 2,
    paddingBottom: space.md,
    gap: 2,
    flexGrow: 1,
    justifyContent: 'flex-start',
    backgroundColor: color.surface,
  },
  listName: {
    ...typo.cardName,
    color: color.ink,
    fontFamily: 'Caros',
  },
  listAgeLocal: {
    ...typo.meta,
    color: color.muted,
    marginTop: 2,
  },
  listIdentity: {
    ...typo.bodySm,
    color: color.inkSoft,
    marginTop: 2,
  },
  listIntro: {
    ...typo.bodySm,
    color: color.inkSoft,
    marginTop: 8,
    lineHeight: 20,
  },
  meetBtn: {
    marginTop: space.md,
    alignSelf: 'stretch',
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.brand,
    alignItems: 'center',
  },
  meetBtnText: {
    ...typo.cta,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listMeta: {
    ...typo.meta,
    color: color.muted,
    marginTop: 4,
  },
  listActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
    gap: space.sm,
  },
  openProfileBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.ink,
    alignItems: 'center',
  },
  openProfileText: {
    ...typo.cta,
    color: color.ink,
  },
  followBtn: {
    paddingVertical: 10,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.follow,
    alignItems: 'center',
  },
  followBtnWide: {
    alignSelf: 'stretch',
  },
  followBtnActive: {
    backgroundColor: '#444',
  },
  followBtnText: {
    ...typo.cta,
    color: '#fff',
  },

  /* Shared CTAs */
  cityGuideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: color.cityGuide,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    gap: 4,
    ...Platform.select({
      web: { boxShadow: '0 2px 10px rgba(224,49,49,0.35)' } as any,
      default: {
        shadowColor: '#E03131',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      },
    }),
  },
  cityGuideBtnProfile: {
    flexShrink: 1,
  },
  cityGuidePlus: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cityGuideLabel: {
    color: '#fff',
    ...typo.cta,
  },
  conciergeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: color.octopusDeep,
    borderWidth: 1.5,
    borderColor: color.octopusBorder,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    maxWidth: '100%',
    ...Platform.select({
      web: { boxShadow: '0 3px 14px rgba(0,0,0,0.28)' } as any,
      default: {
        shadowColor: '#111111',
        shadowOpacity: 0.28,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 5,
      },
    }),
  },
  conciergeBtnProfile: {
    alignSelf: 'stretch',
  },
  conciergePressed: {
    transform: [{ translateY: 1 }],
    opacity: 0.92,
  },
  conciergeIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: 0,
  },
  conciergeCopy: {
    flexShrink: 1,
    minWidth: 0,
  },
  conciergeEyebrow: {
    color: 'rgba(238, 216, 180, 0.92)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  conciergePrimary: {
    color: color.octopusText,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  conciergeSecondary: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 1,
  },
  btnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },

  /* Profile detail */
  detailRoot: {
    width: '100%',
    marginBottom: space.md,
  },
  desktopGalleryHost: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  cityGuideOnPhoto: {
    position: 'absolute',
    left: 10,
    bottom: 14,
    zIndex: 6,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    maxWidth: 132,
  },
  cityGuideOnPhotoInner: {
    padding: 6,
    alignItems: 'center',
    gap: 4,
  },
  cityGuideOnPhotoLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    paddingBottom: 2,
  },
  detailHero: {
    width: '100%',
    maxWidth: layout.contentMax,
    alignSelf: 'center',
    gap: space.lg,
    marginBottom: space.lg,
  },
  detailHeroDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 420,
    maxHeight: 480,
    gap: space.lg,
  },
  galleryCol: {
    flex: 1,
    minWidth: 0,
  },
  galleryColDesktop: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: '58%',
    width: '58%',
    maxWidth: '58%',
    minWidth: 0,
    aspectRatio: layout.galleryMainRatio,
    maxHeight: 480,
  },
  identityCol: {
    width: '100%',
  },
  identityColDesktop: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '42%',
    minWidth: 0,
    justifyContent: 'center',
  },
  desktopGallery: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    gap: space.sm,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    backgroundColor: color.imageFallback,
  },
  desktopGallerySplit: {},
  desktopMainShot: {
    flex: 1,
    height: '100%',
    borderRadius: radius.xxl,
    overflow: 'hidden',
    backgroundColor: color.imageFallback,
    position: 'relative',
  },
  desktopMainShotSolo: {
    flex: 1,
  },
  fillImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  desktopSideCol: {
    width: '34%',
    height: '100%',
    gap: space.sm,
  },
  desktopSideShot: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: color.imageFallback,
    position: 'relative',
  },
  mobileGalleryWrap: {
    width: '100%',
    position: 'relative',
  },
  mobileGalleryScroll: {
    width: '100%',
  },
  mobileSlide: {
    aspectRatio: layout.galleryMainRatio,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    backgroundColor: color.imageFallback,
    position: 'relative',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D0D0D0',
  },
  dotActive: {
    backgroundColor: color.ink,
    width: 16,
  },
  identityPanel: {
    gap: 6,
  },
  identityPanelDesktop: {
    paddingLeft: space.sm,
    paddingVertical: space.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    ...typo.pageTitle,
    color: color.ink,
    fontFamily: 'Caros',
    flexShrink: 1,
  },
  profileNameMobile: {
    ...typo.pageTitleMobile,
  },
  verifiedInline: {
    marginTop: 4,
  },
  octopusVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: color.octopusDeep,
    borderWidth: 1,
    borderColor: color.octopusBorder,
  },
  octopusVerifiedText: {
    color: color.octopusText,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    fontFamily: 'Caros',
  },
  liveStatusCard: {
    marginTop: space.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: '#0F1419',
    borderWidth: 1,
    borderColor: 'rgba(196, 163, 93, 0.45)',
    gap: 6,
  },
  liveStatusKicker: {
    color: '#C4A35D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  liveStatusQuote: {
    color: '#F5F0E8',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    fontFamily: 'Caros',
  },
  profileIdentity: {
    ...typo.body,
    color: color.inkSoft,
    fontWeight: '500',
  },
  profileLocation: {
    ...typo.meta,
    color: color.muted,
    marginTop: 2,
  },
  profileMeta: {
    ...typo.meta,
    color: color.muted,
    marginTop: 2,
  },
  ageSubtle: {
    color: '#A0A0A0',
    fontWeight: '400',
  },
  profileIntro: {
    ...typo.bodySm,
    color: color.inkSoft,
    marginTop: space.sm,
  },
  profileActions: {
    marginTop: space.md,
    gap: space.sm,
  },
  athensBtn: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surfaceWarm,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  athensBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: color.ink,
    fontFamily: 'Caros',
  },
  athensBtnSub: {
    fontSize: 13,
    color: color.muted,
    marginTop: 4,
  },
  passportStrip: {
    marginTop: space.xs,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
    gap: 2,
  },
  passportLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: color.muted,
  },
  passportMeta: {
    ...typo.meta,
    color: color.inkSoft,
  },
  guideMapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  mapWithGuide: {
    /* BanditMiniMapPreview owns size; no scale-down */
  },
  categoryExpandBelow: {
    marginTop: 2,
    marginBottom: 4,
  },
  nativeDetailCategoriesFrontLayer: {
    position: 'relative',
    zIndex: 3,
  },
});
