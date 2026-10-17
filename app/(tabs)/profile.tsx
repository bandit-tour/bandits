import { Image as ExpoImage } from "expo-image";
import { Stack, useRouter, type Href } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useAppState } from "@/contexts/AppStateContext";
import { liveHotelDisplayName } from "@/lib/stay/liveHotelIdentity";
import {
  BOTTLE_JOURNEY_CARDS,
  CITY_GUIDES,
  getMomentAttribution,
  getMomentsNewestFirst,
  JOURNEY_MAP_PLACES,
  LOCAL_FRIENDS,
  MEMORY_PHOTOS,
  PROFILE_EXPERIENCES,
  PROFILE_STAY,
  REWARD_BADGES,
  type ProfileExperience,
} from "@/lib/guest-workspace/profileMemory";
import { banditProfileHrefSafe } from "@/lib/guest-workspace/registeredBanditIds";
import { getMyMomentToday, type GuestMoment } from "@/lib/guest-moment";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { usePremiumRefreshControl } from "@/lib/mobilePullToRefresh";
import { getHotelEntry } from "@/lib/pilotSession";

const EXP_FILTERS = ["upcoming", "completed", "cancelled", "favorite", "wishlist"] as const;
type ExpFilter = (typeof EXP_FILTERS)[number];

const EXP_FILTER_LABELS: Record<ExpFilter, string> = {
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
  favorite: "Favorites",
  wishlist: "Wishlist",
};

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function softShadow() {
  return Platform.select({
    ios: {
      shadowColor: "#1A1410",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
    },
    android: { elevation: 5 },
    default: {},
  });
}

/** Profile = travel memory journal — not settings. */
export default function ProfileHubScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { activeIdentity } = useAppState();
  const { activeStay, isFullStay, isAfterTrip } = useGuestLifecycle();
  const [hotelName, setHotelName] = useState("");
  const [expFilter, setExpFilter] = useState<ExpFilter>("upcoming");

  const guestName = activeIdentity?.displayName?.trim() || "Traveler";
  const avatarUrl = activeIdentity?.avatarUrl;
  const initials = initialsFromName(guestName) || "T";
  const moments = useMemo(() => getMomentsNewestFirst(), []);
  const [todayMoment, setTodayMoment] = useState<GuestMoment | null>(null);
  const photoCols = width >= 720 ? 4 : 3;
  const photoSize = Math.floor((Math.min(width, 720) - 32 - (photoCols - 1) * 6) / photoCols);
  /** SAMPLE journal only for Pilot/demo — ordinary guests see an empty authentic journal. */
  const showSampleJournal = Boolean(
    (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_SHOW_SAMPLE_JOURNAL === "1") ||
      false,
  );
  const realStayLabel = activeStay?.hotelName
    ? isFullStay
      ? `Stay active · ${activeStay.hotelName}`
      : isAfterTrip
        ? `Between trips · ${activeStay.hotelName}`
        : `Connected · ${activeStay.hotelName}`
    : hotelName || "No stay connected yet";

  const reloadProfile = useCallback(async () => {
    const entry = await getHotelEntry();
    setHotelName(liveHotelDisplayName({ entry, slug: entry?.slug }));
    const moment = await getMyMomentToday({
      id: activeIdentity?.userId || "self",
      displayName: guestName,
      city: "Athens",
      stayHint: hotelName,
      avatarInitials: initials,
      kind: "guest",
    });
    setTodayMoment(moment);
  }, [activeIdentity?.userId, guestName, hotelName, initials]);

  React.useEffect(() => {
    void reloadProfile();
  }, [reloadProfile]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void reloadProfile().finally(() => setRefreshing(false));
  }, [reloadProfile]);
  const profileRefreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  const filteredExperiences = useMemo(
    () => PROFILE_EXPERIENCES.filter((e) => e.status === expFilter),
    [expFilter],
  );

  const go = (href: Href) => router.push(href);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={profileRefreshControl}
    >
      <Stack.Screen options={{ headerShown: true, title: "Profile" }} />

      {/* Hero — large profile card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          {avatarUrl ? (
            <ExpoImage source={{ uri: avatarUrl }} style={styles.heroAvatar} contentFit="cover" />
          ) : (
            <View style={styles.heroAvatarFallback}>
              <Text style={styles.heroInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.heroIdentity}>
            <Text style={styles.heroName}>{guestName}</Text>
            <Text style={styles.heroHotel}>{hotelName || activeStay?.hotelName || "bandiTour"}</Text>
            <Text style={styles.heroCity}>{realStayLabel}</Text>
            {!activeStay ? (
              <Text style={styles.heroDays}>Connect My New Stay to unlock hotel stay context</Text>
            ) : null}
          </View>
        </View>
        {showSampleJournal ? (
          <View style={styles.sampleBanner}>
            <Text style={styles.sampleBannerText}>
              SAMPLE journal preview · scores & stories below are not your live stay record
            </Text>
          </View>
        ) : null}
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{isFullStay ? "During stay" : isAfterTrip ? "Between trips" : "Guest"}</Text>
            <Text style={styles.heroStatLabel}>Status</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatValue, styles.sampleMuted]}>—</Text>
            <Text style={styles.heroStatLabel}>Travel score</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatValue, styles.sampleMuted]}>Soon</Text>
            <Text style={styles.heroStatLabel}>Level</Text>
          </View>
        </View>
      </View>

      {/* MY MOMENT — daily social status (bottle discovery) */}
      <Text style={styles.sectionTitle}>My Moment</Text>
      <Text style={styles.sectionLead}>Your status today — may appear on a bottle scan</Text>
      <Pressable
        style={({ pressed }) => [styles.todayMomentCard, pressed && styles.pressed]}
        onPress={() => go("/myMoment" as Href)}
      >
        <Text style={styles.todayMomentKicker}>YOUR MOMENT TODAY</Text>
        <Text style={styles.todayMomentQuote} numberOfLines={4}>
          “{todayMoment?.text || "Set your Moment for today"}”
        </Text>
        <Text style={styles.todayMomentHint}>
          Your Moment may appear when another traveler discovers you through a bandiTour bottle.
        </Text>
        <Text style={styles.openStoryText}>Open My Moment</Text>
      </Pressable>

      {/* Travel stories — journal (not Moments social status) */}
      <Text style={styles.sectionTitle}>Travel stories</Text>
      <Text style={styles.sectionLead}>
        {showSampleJournal
          ? "Sample travel memory (preview) — newest first"
          : "Your travel memory grows from real discoveries, stays and connections"}
      </Text>
      {!showSampleJournal ? (
        <View style={styles.emptyJournal} testID="profile-journal-empty">
          <Text style={styles.emptyJournalTitle}>Your journal starts here</Text>
          <Text style={styles.emptyJournalBody}>
            Bottle discoveries, saved places, Moments and verified stays will appear as you travel —
            never invented sample stories.
          </Text>
        </View>
      ) : null}
      <View style={styles.timeline}>
        {(showSampleJournal ? moments : []).map((moment, index) => {
          const attribution = getMomentAttribution(moment);
          const isLast = index === moments.length - 1;
          return (
            <View key={moment.id} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={styles.timelineDot} />
                {!isLast ? <View style={styles.timelineLine} /> : null}
              </View>
              <Pressable
                style={({ pressed }) => [styles.momentCard, pressed && styles.pressed]}
                onPress={() => go(`/moment/${moment.id}` as Href)}
              >
                <ExpoImage
                  source={{ uri: moment.imageUrl }}
                  style={styles.momentPhoto}
                  contentFit="cover"
                />
                <View style={styles.momentBody}>
                  <Text style={styles.momentSource}>{moment.sourceLabel}</Text>
                  <Text style={styles.momentTitle}>{moment.title}</Text>
                  <Text style={styles.momentDesc} numberOfLines={2}>
                    {moment.description}
                  </Text>
                  <Text style={styles.momentMeta}>
                    {moment.dateLabel} · {moment.city} · {moment.hotel}
                  </Text>
                  <View style={styles.momentAttribution}>
                    {moment.banditAvatarUrl && banditProfileHrefSafe(moment.banditId) ? (
                      <Pressable
                        onPress={() => {
                          const href = banditProfileHrefSafe(moment.banditId);
                          if (href) go(href as Href);
                        }}
                        hitSlop={6}
                      >
                        <ExpoImage
                          source={{ uri: moment.banditAvatarUrl }}
                          style={styles.banditAvatar}
                          contentFit="cover"
                        />
                      </Pressable>
                    ) : moment.banditAvatarUrl ? (
                      <ExpoImage
                        source={{ uri: moment.banditAvatarUrl }}
                        style={styles.banditAvatar}
                        contentFit="cover"
                      />
                    ) : null}
                    <View style={styles.momentAttrText}>
                      <Text style={styles.attrLabel}>{attribution.label}</Text>
                      <Text style={styles.attrName}>{attribution.name}</Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.openStory}
                    onPress={() => go(`/moment/${moment.id}` as Href)}
                  >
                    <Text style={styles.openStoryText}>Open Story</Text>
                  </Pressable>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Journey Map */}
      <Text style={styles.sectionTitle}>Journey Map</Text>
      <Text style={styles.sectionLead}>Hotels · experiences · bottles · cities</Text>
      <View style={styles.mapCard}>
        <View style={styles.mapArt}>
          <Text style={styles.mapArtKicker}>Athens · Greece</Text>
          <Text style={styles.mapArtTitle}>Your path so far</Text>
          <Text style={styles.mapArtSub}>
            {JOURNEY_MAP_PLACES.filter((p) => p.kind === "hotel").length} hotels ·{" "}
            {JOURNEY_MAP_PLACES.filter((p) => p.kind === "experience").length} experiences ·{" "}
            {JOURNEY_MAP_PLACES.filter((p) => p.kind === "bandit").length} banDits
          </Text>
          <Pressable style={styles.mapCta} onPress={() => go("/cityMap" as Href)}>
            <Text style={styles.mapCtaText}>Open map</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mapPlaces}
        >
          {JOURNEY_MAP_PLACES.map((place) => (
            <Pressable
              key={place.id}
              style={({ pressed }) => [styles.mapPlace, pressed && styles.pressed]}
              onPress={() => place.href && go(place.href as Href)}
            >
              <ExpoImage source={{ uri: place.imageUrl }} style={styles.mapPlaceImg} contentFit="cover" />
              <Text style={styles.mapPlaceKind}>{place.kind}</Text>
              <Text style={styles.mapPlaceTitle} numberOfLines={2}>
                {place.title}
              </Text>
              <Text style={styles.mapPlaceSub} numberOfLines={1}>
                {place.subtitle}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* My Local Friends */}
      <Text style={styles.sectionTitle}>My Local Friends</Text>
      <Text style={styles.sectionLead}>Followed · met · chats · premium</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.friendsRow}
      >
        {LOCAL_FRIENDS.map((friend) => {
          const friendHref = banditProfileHrefSafe(friend.id);
          return (
          <Pressable
            key={friend.id}
            style={({ pressed }) => [styles.friendCard, pressed && styles.pressed]}
            onPress={() => {
              if (friendHref) go(friendHref as Href);
            }}
            disabled={!friendHref}
          >
            <ExpoImage source={{ uri: friend.avatarUrl }} style={styles.friendAvatar} contentFit="cover" />
            <Text style={styles.friendName} numberOfLines={1}>
              {friend.name}
            </Text>
            <Text style={styles.friendRel}>{friend.relationLabel}</Text>
            <Text style={styles.friendLine} numberOfLines={2}>
              {friend.lastLine}
            </Text>
            <View style={styles.friendActions}>
              <Pressable
                onPress={() => {
                  if (friendHref) go(friendHref as Href);
                }}
                hitSlop={4}
                disabled={!friendHref}
              >
                <Text style={styles.friendLink}>Profile</Text>
              </Pressable>
              <Text style={styles.friendDot}>·</Text>
              <Pressable onPress={() => go("/localFriend" as Href)} hitSlop={4}>
                <Text style={styles.friendLink}>Chat</Text>
              </Pressable>
            </View>
          </Pressable>
          );
        })}
      </ScrollView>

      {/* My Experiences */}
      <Text style={styles.sectionTitle}>My Experiences</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {EXP_FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.chip, expFilter === f && styles.chipOn]}
            onPress={() => setExpFilter(f)}
          >
            <Text style={[styles.chipText, expFilter === f && styles.chipTextOn]}>
              {EXP_FILTER_LABELS[f]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {filteredExperiences.length === 0 ? (
        <Text style={styles.emptyHint}>Nothing here yet — explore Experiences.</Text>
      ) : (
        filteredExperiences.map((exp) => (
          <ExperienceCard key={exp.id} exp={exp} onPress={() => go(`/experience/${exp.experienceId}` as Href)} />
        ))
      )}
      <Pressable style={styles.secondaryLink} onPress={() => go("/experiences" as Href)}>
        <Text style={styles.secondaryLinkText}>Browse all experiences →</Text>
      </Pressable>

      {/* My City Guides */}
      <Text style={styles.sectionTitle}>My City Guides</Text>
      <Text style={styles.sectionLead}>Collected · offline · premium · downloaded</Text>
      {CITY_GUIDES.map((guide) => (
        <Pressable
          key={guide.id}
          style={({ pressed }) => [styles.guideCard, pressed && styles.pressed]}
          onPress={() => go("/cityGuide" as Href)}
        >
          <ExpoImage source={{ uri: guide.coverUrl }} style={styles.guideCover} contentFit="cover" />
          <View style={styles.guideBody}>
            <Text style={styles.guideStatus}>{guide.statusLabel}</Text>
            <Text style={styles.guideTitle}>{guide.title}</Text>
            <Text style={styles.guideCity}>{guide.city}</Text>
          </View>
        </Pressable>
      ))}

      {/* My Bottle Journeys */}
      <Text style={styles.sectionTitle}>My Bottle Journeys</Text>
      <Text style={styles.sectionLead}>Hotel → second stay · continue the story</Text>
      {BOTTLE_JOURNEY_CARDS.map((bj) => (
        <Pressable
          key={bj.id}
          style={({ pressed }) => [styles.bottleCard, pressed && styles.pressed]}
          onPress={() => go(`/journey/${bj.journeyId}` as Href)}
        >
          <ExpoImage source={{ uri: bj.imageUrl }} style={styles.bottleImg} contentFit="cover" />
          <View style={styles.bottleBody}>
            <Text style={styles.bottlePair}>
              {bj.fromHotel} → {bj.toStay}
            </Text>
            <Text style={styles.bottleTitle}>{bj.title}</Text>
            <Text
              style={[
                styles.bottleStatus,
                bj.status === "completed" && styles.bottleDone,
                bj.status === "in_progress" && styles.bottleActive,
              ]}
            >
              {bj.statusLabel}
            </Text>
            {bj.status !== "completed" ? (
              <Pressable
                style={styles.continueBtn}
                onPress={() =>
                  go(
                    (bj.status === "in_progress" ? "/travelBottle" : `/journey/${bj.journeyId}`) as Href,
                  )
                }
              >
                <Text style={styles.continueBtnText}>Continue journey</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      ))}

      {/* Rewards — never present PROFILE_STAY sample score as a live guest record */}
      <Text style={styles.sectionTitle}>Rewards</Text>
      <View style={styles.rewardsHero} testID="profile-rewards-hero">
        {showSampleJournal ? (
          <>
            <Text style={styles.rewardsScore}>{PROFILE_STAY.travelScore}</Text>
            <Text style={styles.rewardsScoreLabel}>Travel score (sample)</Text>
            <Text style={styles.rewardsLevel}>
              {PROFILE_STAY.travelLevel} · {PROFILE_STAY.premiumStatus}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.rewardsScore, styles.sampleMuted]}>—</Text>
            <Text style={styles.rewardsScoreLabel}>Travel score</Text>
            <Text style={styles.rewardsLevel}>Earn from verified stays & discoveries</Text>
          </>
        )}
      </View>
      <View style={styles.badgeGrid}>
        {(showSampleJournal ? REWARD_BADGES : REWARD_BADGES.map((b) => ({ ...b, earned: false }))).map(
          (badge) => (
            <View key={badge.id} style={[styles.badgeCard, !badge.earned && styles.badgeLocked]}>
              <Text style={styles.badgeTitle}>{badge.title}</Text>
              <Text style={styles.badgeDetail}>{badge.detail}</Text>
              <Text style={styles.badgeState}>{badge.earned ? "Earned" : "Locked"}</Text>
            </View>
          ),
        )}
      </View>
      <Pressable style={styles.secondaryLink} onPress={() => go("/impact" as Href)}>
        <Text style={styles.secondaryLinkText}>Impact Passport & loyalty →</Text>
      </Pressable>

      {/* Photos */}
      <Text style={styles.sectionTitle}>Photos</Text>
      <Text style={styles.sectionLead}>Gallery of your travel memories</Text>
      <View style={styles.photoGrid}>
        {MEMORY_PHOTOS.map((photo) => (
          <Pressable
            key={photo.id}
            onPress={() =>
              photo.momentId
                ? go(`/moment/${photo.momentId}` as Href)
                : undefined
            }
            style={{ width: photoSize, marginBottom: 6 }}
          >
            <ExpoImage
              source={{ uri: photo.imageUrl }}
              style={{ width: photoSize, height: photoSize, borderRadius: 12 }}
              contentFit="cover"
            />
          </Pressable>
        ))}
      </View>

      {/* Settings — secondary only */}
      <Pressable style={styles.settingsLink} onPress={() => go("/account" as Href)}>
        <Text style={styles.settingsLinkText}>Account & settings</Text>
      </Pressable>
    </ScrollView>
  );
}

function ExperienceCard({
  exp,
  onPress,
}: {
  exp: ProfileExperience;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.expCard, pressed && styles.pressed]} onPress={onPress}>
      <ExpoImage source={{ uri: exp.imageUrl }} style={styles.expImg} contentFit="cover" />
      <View style={styles.expBody}>
        <Text style={styles.expWhen}>{exp.when}</Text>
        <Text style={styles.expTitle}>{exp.title}</Text>
        <Text style={styles.expArea}>{exp.area}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F3EFE8" },
  content: { padding: 16, paddingBottom: 56, maxWidth: 720, width: "100%", alignSelf: "center" },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },

  heroCard: {
    backgroundColor: "#1C1814",
    borderRadius: 28,
    padding: 22,
    marginBottom: 28,
    ...softShadow(),
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  heroAvatar: { width: 84, height: 84, borderRadius: 42 },
  heroAvatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(232,196,140,0.22)",
    borderWidth: 1.5,
    borderColor: "rgba(232,196,140,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroInitials: { color: "#F0D7A0", fontSize: 28, fontWeight: "800" },
  heroIdentity: { flex: 1, minWidth: 0 },
  heroName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: -0.6,
  },
  heroHotel: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(240,215,160,0.95)",
    marginTop: 4,
  },
  heroCity: { fontSize: 14, color: "rgba(255,255,255,0.72)", marginTop: 6 },
  heroDays: { fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 2 },
  emptyJournal: {
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#F4F0E8",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(28,24,20,0.12)",
  },
  emptyJournalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1C1814",
    marginBottom: 6,
  },
  emptyJournalBody: {
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(28,24,20,0.72)",
  },
  sampleBanner: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(240,215,160,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(240,215,160,0.35)",
  },
  sampleBannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(240,215,160,0.95)",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  sampleMuted: { opacity: 0.55 },
  heroStats: {
    flexDirection: "row",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  heroStatValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#F0D7A0",
    textAlign: "center",
  },
  heroStatLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1C1814",
    letterSpacing: -0.4,
    marginTop: 8,
  },
  sectionLead: {
    fontSize: 14,
    color: "#6B6358",
    marginTop: 4,
    marginBottom: 14,
  },

  todayMomentCard: {
    backgroundColor: "#FAF9F7",
    borderRadius: 22,
    padding: 20,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "rgba(28,24,20,0.08)",
    ...softShadow(),
  },
  todayMomentKicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#8A7F72",
    marginBottom: 10,
  },
  todayMomentQuote: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1814",
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  todayMomentHint: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B6358",
  },

  timeline: { marginBottom: 12 },
  timelineRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  timelineRail: { width: 16, alignItems: "center" },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#C4A574",
    marginTop: 28,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "rgba(196,165,116,0.35)",
    marginTop: 4,
    minHeight: 40,
  },
  momentCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 16,
    ...softShadow(),
  },
  momentPhoto: { width: "100%", height: 168 },
  momentBody: { padding: 16 },
  momentSource: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9A7B4F",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  momentTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1C1814",
    marginTop: 4,
    letterSpacing: -0.3,
  },
  momentDesc: { fontSize: 14, color: "#5A5348", marginTop: 6, lineHeight: 20 },
  momentMeta: { fontSize: 12, color: "#8A8278", marginTop: 8 },
  momentAttribution: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EDE8DF",
  },
  banditAvatar: { width: 36, height: 36, borderRadius: 18 },
  momentAttrText: { flex: 1 },
  attrLabel: { fontSize: 11, color: "#8A8278", fontWeight: "600" },
  attrName: { fontSize: 14, fontWeight: "700", color: "#1C1814", marginTop: 1 },
  openStory: {
    alignSelf: "flex-start",
    marginTop: 14,
    backgroundColor: "#1C1814",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  openStoryText: { color: "#F0D7A0", fontWeight: "800", fontSize: 13 },

  mapCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 24,
    ...softShadow(),
  },
  mapArt: {
    backgroundColor: "#2A3A42",
    padding: 22,
    minHeight: 140,
  },
  mapArtKicker: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(232,196,140,0.9)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  mapArtTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFF",
    marginTop: 6,
    letterSpacing: -0.4,
  },
  mapArtSub: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 6 },
  mapCta: {
    alignSelf: "flex-start",
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  mapCtaText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  mapPlaces: { padding: 14, gap: 10 },
  mapPlace: { width: 140 },
  mapPlaceImg: { width: 140, height: 96, borderRadius: 14 },
  mapPlaceKind: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9A7B4F",
    textTransform: "uppercase",
    marginTop: 8,
    letterSpacing: 0.4,
  },
  mapPlaceTitle: { fontSize: 14, fontWeight: "700", color: "#1C1814", marginTop: 2 },
  mapPlaceSub: { fontSize: 12, color: "#8A8278", marginTop: 2 },

  friendsRow: { gap: 12, paddingBottom: 8, marginBottom: 16 },
  friendCard: {
    width: 168,
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 14,
    ...softShadow(),
  },
  friendAvatar: { width: 56, height: 56, borderRadius: 28 },
  friendName: { fontSize: 15, fontWeight: "800", color: "#1C1814", marginTop: 10 },
  friendRel: { fontSize: 11, fontWeight: "700", color: "#9A7B4F", marginTop: 3 },
  friendLine: { fontSize: 12, color: "#6B6358", marginTop: 8, lineHeight: 17, minHeight: 34 },
  friendActions: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  friendLink: { fontSize: 12, fontWeight: "700", color: "#1C1814" },
  friendDot: { color: "#C4BBB0" },

  chipRow: { gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(28,24,20,0.06)",
  },
  chipOn: { backgroundColor: "#1C1814" },
  chipText: { fontSize: 13, fontWeight: "700", color: "#5A5348" },
  chipTextOn: { color: "#F0D7A0" },
  emptyHint: { fontSize: 14, color: "#8A8278", marginBottom: 12 },
  expCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 10,
    ...softShadow(),
  },
  expImg: { width: 96, height: 96 },
  expBody: { flex: 1, padding: 12, justifyContent: "center" },
  expWhen: { fontSize: 11, fontWeight: "700", color: "#9A7B4F" },
  expTitle: { fontSize: 16, fontWeight: "800", color: "#1C1814", marginTop: 2 },
  expArea: { fontSize: 13, color: "#8A8278", marginTop: 4 },
  secondaryLink: { paddingVertical: 10, marginBottom: 8 },
  secondaryLinkText: { fontSize: 14, fontWeight: "700", color: "#6B6358" },

  guideCard: {
    flexDirection: "row",
    backgroundColor: "#243038",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 10,
    ...softShadow(),
  },
  guideCover: { width: 88, height: 100 },
  guideBody: { flex: 1, padding: 14, justifyContent: "center" },
  guideStatus: { fontSize: 11, fontWeight: "700", color: "rgba(240,215,160,0.9)" },
  guideTitle: { fontSize: 16, fontWeight: "800", color: "#FFF", marginTop: 4 },
  guideCity: { fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 4 },

  bottleCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 12,
    ...softShadow(),
  },
  bottleImg: { width: "100%", height: 140 },
  bottleBody: { padding: 14 },
  bottlePair: { fontSize: 12, fontWeight: "600", color: "#8A8278" },
  bottleTitle: { fontSize: 18, fontWeight: "800", color: "#1C1814", marginTop: 4 },
  bottleStatus: { fontSize: 13, fontWeight: "700", color: "#6B6358", marginTop: 6 },
  bottleDone: { color: "#3D6B4F" },
  bottleActive: { color: "#9A7B4F" },
  continueBtn: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: "#C4A574",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  continueBtnText: { fontWeight: "800", fontSize: 13, color: "#1C1814" },

  rewardsHero: {
    backgroundColor: "#1C1814",
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    marginBottom: 12,
    ...softShadow(),
  },
  rewardsScore: { fontSize: 48, fontWeight: "800", color: "#F0D7A0", letterSpacing: -1 },
  rewardsScoreLabel: { fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 2 },
  rewardsLevel: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.8)", marginTop: 8 },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  badgeCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    ...softShadow(),
  },
  badgeLocked: { opacity: 0.55 },
  badgeTitle: { fontSize: 14, fontWeight: "800", color: "#1C1814" },
  badgeDetail: { fontSize: 12, color: "#6B6358", marginTop: 4, lineHeight: 16 },
  badgeState: { fontSize: 11, fontWeight: "700", color: "#9A7B4F", marginTop: 8 },

  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 20,
  },

  settingsLink: {
    alignSelf: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  settingsLinkText: {
    fontSize: 13,
    color: "#8A8278",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
