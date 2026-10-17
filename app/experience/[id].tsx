import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MeetingPointMap } from "@/components/experience/MeetingPointMap";
import { useAppBackNavigation } from "@/hooks/useAppBackScreenOptions";
import {
  getExperienceDetail,
  type ExperienceAvailabilitySlot,
  type ExperienceDetail,
  type ExperienceReview,
} from "@/lib/guest-workspace/experienceDetail";
import { fetchLiveExperienceDetail } from "@/lib/guest-workspace/liveExperiences";
import {
  experienceBookingTotalCents,
  formatEuro,
  formatExperiencePrice,
  formatMoney,
  isEditorialExperienceId,
} from "@/lib/guest-workspace/productWorlds";
import { supabase } from "@/lib/supabase";
import { ImageRatio, imageFocusStyle } from "@/lib/imageRatios";
import { bookExperienceViaCommerce } from "@/lib/orchestra/commerceBook";
import { ensureAnonymousSession } from "@/lib/pilotSession";
import { routeParamString } from "@/lib/routeParams";

const ACCENT = "#B85C38";
const INK = "#1A1A1A";
const MUTED = "#6A655C";
const PAPER = "#FFFCF8";

type BookingStep = "dates" | "guests" | "review" | "paying" | "done";

/**
 * Experience detail — Airbnb Experiences information hierarchy,
 * bandiTour visual language. Sticky chrome + Commerce OS checkout.
 */
export default function ExperienceDetailScreen() {
  const raw = useLocalSearchParams<{ id?: string | string[] }>();
  const id = routeParamString(raw.id);
  const catalog = useMemo(() => (id ? getExperienceDetail(id) : undefined), [id]);
  const [liveExp, setLiveExp] = useState<ExperienceDetail | null>(null);
  const [liveFetchDone, setLiveFetchDone] = useState(false);
  /** Editorial DNA only when Workspace has no live row for this id. */
  const isPreview = Boolean(
    id && liveFetchDone && !liveExp && isEditorialExperienceId(id) && catalog,
  );
  /** Live Workspace inventory wins over seed catalog for supplier price + basis. */
  const exp = liveExp ?? catalog ?? undefined;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W } = useWindowDimensions();
  const isDesktopGallery = SCREEN_W >= 900;
  /** Mobile: 4:5 portrait carousel. Desktop mosaic uses ratio frames — not a strip. */
  const GALLERY_H = Math.round(SCREEN_W * (5 / 4));
  const goBack = useAppBackNavigation("/experiences" as Href);

  const [galleryIndex, setGalleryIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookStep, setBookStep] = useState<BookingStep>("dates");
  const [guestCount, setGuestCount] = useState(1);
  const [bookError, setBookError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [deadGallery, setDeadGallery] = useState<Set<string>>(() => new Set());
  const galleryRef = useRef<ScrollView>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [availY, setAvailY] = useState(0);

  useEffect(() => {
    if (!id || isPreview) {
      setLiveFetchDone(true);
      return;
    }
    setLiveFetchDone(false);
    let cancelled = false;
    void fetchLiveExperienceDetail(id).then((row) => {
      if (cancelled) return;
      setLiveExp(row);
      setLiveFetchDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, isPreview]);

  const liveGallery = useMemo(() => {
    if (!exp) return [] as string[];
    return exp.gallery.filter((uri) => !deadGallery.has(uri));
  }, [exp, deadGallery]);

  const markGalleryDead = useCallback((uri: string) => {
    setDeadGallery((prev) => {
      if (prev.has(uri)) return prev;
      const next = new Set(prev);
      next.add(uri);
      return next;
    });
  }, []);

  const selectedSlot = useMemo(
    () => exp?.availability.find((s) => s.id === selectedSlotId) ?? null,
    [exp, selectedSlotId],
  );

  const onGalleryScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / SCREEN_W);
      setGalleryIndex(i);
    },
    [SCREEN_W],
  );

  const shareExperience = useCallback(async () => {
    if (!exp) return;
    try {
      await Share.share({
        message: `${exp.title} · ${exp.area} · ${formatEuro(exp.priceCents)} · bandiTour`,
        title: exp.title,
      });
    } catch {
      /* dismissed */
    }
  }, [exp]);

  const openBooking = useCallback((step: BookingStep = "dates") => {
    if (isPreview) return;
    setBookError(null);
    setBookStep(step);
    setBookOpen(true);
  }, [isPreview]);

  const scrollToDates = useCallback(() => {
    if (isPreview) return;
    if (selectedSlot) {
      openBooking("review");
      return;
    }
    if (availY > 0) {
      scrollRef.current?.scrollTo({ y: Math.max(0, availY - 80), animated: true });
    }
    openBooking("dates");
  }, [availY, isPreview, openBooking, selectedSlot]);

  const openHost = useCallback(() => {
    const hostId = exp?.hostProfile?.id;
    if (!hostId || !exp) return;
    router.push(
      `/host/${encodeURIComponent(hostId)}?fromExperience=${encodeURIComponent(exp.id)}` as Href,
    );
  }, [exp, router]);

  const messageHost = useCallback(() => {
    if (!exp?.hostProfile.messageViaLocalFriend) return;
    router.push("/localFriend" as Href);
  }, [exp, router]);

  const confirmPay = useCallback(async () => {
    if (!exp || !selectedSlot) return;
    if (isPreview) {
      setBookStep("review");
      setBookError("This is a preview experience — reservations are not open yet.");
      return;
    }
    setBookError(null);
    setBookStep("paying");

    await ensureAnonymousSession();
    invalidateAuthUserCache();
    const user = await getCachedAuthUser();
    const guestEmail = (user as { email?: string } | null)?.email;
    if (!guestEmail) {
      setBookStep("review");
      setBookError("Sign in required for Commerce checkout — payment was not charged.");
      return;
    }
    const customerId = user?.id ?? (exp.commerceWorkspaceId === "local-experiences" ? "guest_bridge" : null);
    if (!customerId) {
      setBookStep("review");
      setBookError(
        "Guest identity is required for Commerce OS checkout. Session could not be established — payment was not charged.",
      );
      return;
    }
    if (!exp.commerceProductId) {
      setBookStep("review");
      setBookError(
        "Commerce OS product mapping is not configured for this experience yet — payment was not charged.",
      );
      return;
    }

    const result = await bookExperienceViaCommerce({
      workspaceId: exp.commerceWorkspaceId,
      productId: exp.commerceProductId,
      customerId,
      idempotencyKey: `exp-${exp.id}-${selectedSlot.id}-${customerId}-${guestCount}-${Date.now()}`,
      experienceId: exp.id,
      experienceTitle: exp.title,
      slotId: selectedSlot.id,
      guestCount,
      slotLabel: `${selectedSlot.label} · ${selectedSlot.timeRange}`,
      guestEmail,
    });

    if (!result.ok) {
      setBookStep("review");
      setBookError(
        result.detail ||
          "Checkout did not complete. Payment was not confirmed.",
      );
      return;
    }

    setOrderId(String(result.data.order.id ?? ""));
    setBookStep("done");
  }, [exp, selectedSlot, guestCount, isPreview]);

  if (!exp && !liveFetchDone) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={ACCENT} />
        <Text style={[styles.missingText, { marginTop: 12 }]}>Loading experience…</Text>
      </View>
    );
  }

  if (!exp) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.missingText}>Experience not found</Text>
        <Pressable onPress={goBack} style={styles.missingBack}>
          <Text style={styles.missingBackText}>← Experiences</Text>
        </Pressable>
      </View>
    );
  }

  // Image law: never keep a detail page open with zero working photos.
  if (liveGallery.length === 0) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.missingText}>This listing is unavailable</Text>
        <Pressable onPress={goBack} style={styles.missingBack}>
          <Text style={styles.missingBackText}>← Experiences</Text>
        </Pressable>
      </View>
    );
  }

  const visibleReviews = showAllReviews ? exp.reviews : exp.reviews.slice(0, 2);
  const unitCents = selectedSlot?.priceCents ?? exp.priceCents;
  const priceBasis = exp.priceBasis;
  const priceCurrency = exp.currency || "EUR";
  const stickyPriceLabel = formatExperiencePrice(unitCents, priceBasis, priceCurrency);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        scrollEventThrottle={16}
      >
        {/* 2 · Image gallery — only live URIs; never empty beige frames */}
        {liveGallery.length === 0 ? null : isDesktopGallery ? (
          <Pressable style={styles.desktopGallery} onPress={() => setFullscreen(true)}>
            <View style={styles.desktopMain}>
              <ExpoImage
                source={{ uri: liveGallery[0] }}
                style={[StyleSheet.absoluteFillObject, imageFocusStyle("center")]}
                contentFit="cover"
                priority="high"
                onError={() => markGalleryDead(liveGallery[0]!)}
              />
            </View>
            <View style={styles.desktopSide}>
              {liveGallery.slice(1, 5).map((uri, i) => (
                <View key={`${uri}-${i}`} style={styles.desktopThumb}>
                  <ExpoImage
                    source={{ uri }}
                    style={[StyleSheet.absoluteFillObject, imageFocusStyle("center")]}
                    contentFit="cover"
                    onError={() => markGalleryDead(uri)}
                  />
                </View>
              ))}
            </View>
          </Pressable>
        ) : (
          <View style={[styles.galleryWrap, { height: GALLERY_H }]}>
            <ScrollView
              ref={galleryRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onGalleryScroll}
              scrollEventThrottle={16}
            >
              {liveGallery.map((uri, index) => (
                <Pressable key={uri} onPress={() => setFullscreen(true)}>
                  <ExpoImage
                    source={{ uri }}
                    style={[
                      { width: SCREEN_W, height: GALLERY_H },
                      imageFocusStyle("center"),
                    ]}
                    contentFit="cover"
                    priority={index === 0 ? "high" : "normal"}
                    onError={() => markGalleryDead(uri)}
                  />
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.galleryCounter}>
              <Text style={styles.galleryCounterText}>
                {Math.min(galleryIndex + 1, liveGallery.length)} / {liveGallery.length}
              </Text>
            </View>
            <View style={styles.dots}>
              {liveGallery.map((_, i) => (
                <View key={i} style={[styles.dot, i === galleryIndex && styles.dotOn]} />
              ))}
            </View>
          </View>
        )}

        {/* 3 · Title block */}
        <View style={styles.pad}>
          <Text style={styles.categoryLine}>
            {(exp.categoryLabel || exp.category)} · {exp.area}
          </Text>
          <Text style={styles.title}>{exp.title}</Text>
          <Text style={styles.shortDesc}>{exp.shortDescription}</Text>
          {isPreview ? (
            <Text style={styles.ratingText}>Preview · editorial inspiration · not a live listing</Text>
          ) : (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={INK} />
              <Text style={styles.ratingText}>
                {exp.rating.toFixed(2)} · {exp.reviewCount} reviews
              </Text>
            </View>
          )}
        </View>

        <View style={styles.rule} />

        {/* 4 · Host block */}
        <Pressable style={[styles.pad, styles.hostRow]} onPress={openHost}>
          <ExpoImage
            source={{ uri: exp.hostProfile.photoUrl }}
            style={styles.hostAvatar}
            contentFit="cover"
          />
          <View style={styles.hostCopy}>
            <Text style={styles.hostBy}>Hosted by {exp.hostProfile.name}</Text>
            <Text style={styles.hostExpertise}>{exp.hostProfile.expertise}</Text>
            <Text style={styles.hostLink}>View host profile →</Text>
          </View>
        </Pressable>

        <View style={styles.rule} />

        {/* 5 · Core facts */}
        <View style={styles.pad}>
          <Text style={styles.sectionTitle}>Experience details</Text>
          <View style={styles.factsGrid}>
            <Fact icon="location-outline" label="Meeting area" value={exp.coreFacts.meetingArea} />
            <Fact icon="time-outline" label="Duration" value={exp.coreFacts.duration} />
            <Fact
              icon="chatbubbles-outline"
              label="Languages"
              value={exp.coreFacts.languages.join(", ")}
            />
            <Fact icon="people-outline" label="Group size" value={exp.coreFacts.groupSize} />
            <Fact icon="leaf-outline" label="Setting" value={exp.coreFacts.setting} />
            {exp.coreFacts.accessibilityNote ? (
              <Fact
                icon="accessibility-outline"
                label="Accessibility"
                value={exp.coreFacts.accessibilityNote}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.rule} />

        {/* 6 · What you’ll do */}
        <View style={styles.pad}>
          <Text style={styles.sectionTitle}>What you’ll do</Text>
          {exp.itinerary.map((s, i) => (
            <View key={s.id} style={styles.itineraryStep}>
              <View style={styles.itineraryRail}>
                <View style={styles.itineraryNum}>
                  <Text style={styles.itineraryNumText}>{i + 1}</Text>
                </View>
                {i < exp.itinerary.length - 1 ? <View style={styles.itineraryLine} /> : null}
              </View>
              <View style={styles.itineraryBody}>
                <ExpoImage source={{ uri: s.imageUrl }} style={styles.itineraryThumb} contentFit="cover" />
                <View style={styles.itineraryCopy}>
                  <Text style={styles.itineraryTitle}>{s.title}</Text>
                  <Text style={styles.itineraryDur}>{s.durationLabel}</Text>
                  <Text style={styles.itineraryDesc}>{s.description}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.rule} />

        {/* 7 · Reviews — live listings only (no synthetic social proof on previews) */}
        {!isPreview ? (
          <>
            <View style={styles.pad}>
              <View style={styles.reviewsHeader}>
                <Ionicons name="star" size={18} color={INK} />
                <Text style={styles.sectionTitleInline}>
                  {exp.rating.toFixed(2)} · {exp.reviewCount} reviews
                </Text>
              </View>
              {visibleReviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
              {exp.reviews.length > 2 ? (
                <Pressable
                  style={styles.showAllBtn}
                  onPress={() => setShowAllReviews((v) => !v)}
                >
                  <Text style={styles.showAllText}>
                    {showAllReviews ? "Show fewer reviews" : `Show all ${exp.reviews.length} reviews`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.rule} />
          </>
        ) : (
          <View style={styles.rule} />
        )}

        {/* 8 · Upcoming availability — live only */}
        <View
          style={styles.pad}
          onLayout={(e) => setAvailY(e.nativeEvent.layout.y)}
        >
          <Text style={styles.sectionTitle}>Upcoming availability</Text>
          {isPreview ? (
            <Text style={styles.sectionLead}>
              Dates open when a local host publishes this as a live Workspace listing.
            </Text>
          ) : (
            <>
              <Text style={styles.sectionLead}>Choose a date and time to continue booking</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.slotRail}
              >
                {exp.availability.map((slot) => {
                  const on = selectedSlotId === slot.id;
                  return (
                    <Pressable
                      key={slot.id}
                      style={[styles.slotCard, on && styles.slotCardOn]}
                      onPress={() => {
                        setSelectedSlotId(slot.id);
                        openBooking("guests");
                      }}
                    >
                      <Text style={[styles.slotLabel, on && styles.slotLabelOn]}>{slot.label}</Text>
                      <Text style={[styles.slotTime, on && styles.slotTimeOn]}>{slot.timeRange}</Text>
                      <Text style={[styles.slotMeta, on && styles.slotMetaOn]}>
                        {slot.spotsLeft} spots · {slot.language}
                      </Text>
                      <Text style={[styles.slotPrice, on && styles.slotPriceOn]}>
                        {formatExperiencePrice(slot.priceCents, priceBasis, priceCurrency)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>

        <View style={styles.rule} />

        {/* 9 · Where we’ll meet */}
        <View style={styles.pad}>
          <Text style={styles.sectionTitle}>Where we’ll meet</Text>
          <Text style={styles.meetingDesc}>{exp.meeting.description}</Text>
          <Text style={styles.meetingAddress}>{exp.meeting.address}</Text>
          <Text style={styles.meetingHint}>{exp.meeting.directionsHint}</Text>
          <View style={styles.mapWrap}>
            <MeetingPointMap
              lat={exp.meeting.lat}
              lng={exp.meeting.lng}
              label={exp.meeting.label}
              height={220}
            />
          </View>
        </View>

        <View style={styles.rule} />

        {/* 10 · About the host — circular avatar, never a wide strip */}
        <View style={styles.pad}>
          <Text style={styles.sectionTitle}>About the host</Text>
          <View style={styles.hostAboutRow}>
            <ExpoImage
              source={{ uri: exp.hostProfile.photoUrl }}
              style={styles.hostPortrait}
              contentFit="cover"
            />
            <View style={styles.hostAboutCopy}>
              <Text style={styles.hostNameLg}>{exp.hostProfile.name}</Text>
              <Text style={styles.hostExpertiseLg}>{exp.hostProfile.expertise}</Text>
              <Text style={styles.hostYears}>
                {exp.hostProfile.yearsHosting} years hosting ·{" "}
                {exp.hostProfile.languages.join(" · ")}
              </Text>
            </View>
          </View>
          <Text style={styles.hostBio}>{exp.hostProfile.bio}</Text>
          <View style={styles.credList}>
            {exp.hostProfile.credentials.map((c) => (
              <Text key={c} style={styles.credItem}>
                · {c}
              </Text>
            ))}
          </View>
          <View style={styles.hostActions}>
            {exp.hostProfile.id || exp.hostProfile.banditId ? (
              <Pressable style={styles.secondaryBtn} onPress={openHost}>
                <Text style={styles.secondaryBtnText}>View profile</Text>
              </Pressable>
            ) : null}
            {exp.hostProfile.messageViaLocalFriend ? (
              <Pressable style={styles.secondaryBtn} onPress={messageHost}>
                <Text style={styles.secondaryBtnText}>Message host</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.rule} />

        {/* 11 · Things to know */}
        <View style={styles.pad}>
          <Text style={styles.sectionTitle}>Things to know</Text>
          <KnowBlock title="Guest requirements" items={exp.thingsToKnow.guestRequirements} />
          <KnowBlock title="Accessibility" items={exp.thingsToKnow.accessibility} />
          <KnowBlock title="What to bring" items={exp.thingsToKnow.whatToBring} />
          <KnowBlock title="Safety" items={exp.thingsToKnow.safety} />
          <Text style={styles.knowTitle}>Age requirements</Text>
          <Text style={styles.knowBody}>{exp.thingsToKnow.ageRequirements}</Text>
          <Text style={styles.knowTitle}>Cancellation</Text>
          <Text style={styles.knowBody}>{exp.thingsToKnow.cancellation}</Text>
          <Text style={styles.knowTitle}>Host responsibility</Text>
          <Text style={styles.knowBody}>{exp.thingsToKnow.hostResponsibility}</Text>
        </View>
      </ScrollView>

      {/* 1 · Sticky top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={styles.topBtn} onPress={goBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={INK} />
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.topCat} numberOfLines={1}>
            {exp.category}
          </Text>
          <Text style={styles.topLoc} numberOfLines={1}>
            {exp.area}
          </Text>
        </View>
        <Pressable style={styles.topBtn} onPress={() => void shareExperience()} hitSlop={8}>
          <Ionicons name="share-outline" size={20} color={INK} />
        </Pressable>
        <Pressable
          style={styles.topBtn}
          onPress={() => setSaved((s) => !s)}
          hitSlop={8}
          accessibilityLabel={saved ? "Unsave" : "Save"}
        >
          <Ionicons name={saved ? "heart" : "heart-outline"} size={20} color={saved ? ACCENT : INK} />
        </Pressable>
      </View>

      {/* 12 · Sticky booking bar — live only; editorial previews cannot reserve/pay */}
      <View style={[styles.bookBar, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <View style={styles.bookBarLeft}>
          {isPreview ? (
            <>
              <Text style={styles.bookPrice}>Preview</Text>
              <Text style={styles.bookCancel}>Inspiration only · not open to book</Text>
            </>
          ) : (
            <>
              <Text style={styles.bookPrice}>{stickyPriceLabel}</Text>
              <Text style={styles.bookCancel}>{exp.cancellationPolicyShort}</Text>
            </>
          )}
        </View>
        {isPreview ? (
          <Pressable
            style={[styles.bookCta, styles.bookCtaPreview]}
            onPress={goBack}
            testID="exp-preview-cta"
            accessibilityRole="button"
            accessibilityLabel="Back to Experiences"
          >
            <Text style={styles.bookCtaText}>Preview only</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.bookCta} onPress={scrollToDates} testID="exp-book-cta">
            <Text style={styles.bookCtaText}>
              {selectedSlot ? "Book" : "Show dates"}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Full-screen gallery */}
      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <View style={[styles.fsRoot, { paddingTop: insets.top }]}>
          <Pressable style={styles.fsClose} onPress={() => setFullscreen(false)}>
            <Ionicons name="close" size={28} color="#FFF" />
          </Pressable>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: galleryIndex * SCREEN_W, y: 0 }}
          >
            {liveGallery.map((uri) => (
              <ExpoImage
                key={`fs-${uri}`}
                source={{ uri }}
                style={{ width: SCREEN_W, height: "100%" }}
                contentFit="contain"
                onError={() => markGalleryDead(uri)}
              />
            ))}
          </ScrollView>
          <Text style={[styles.fsCounter, { bottom: insets.bottom + 20 }]}>
            {Math.min(galleryIndex + 1, liveGallery.length)} / {liveGallery.length}
          </Text>
        </View>
      </Modal>

      {/* Booking sheet — never for editorial previews */}
      {!isPreview ? (
        <BookingSheet
          visible={bookOpen}
          onClose={() => {
            if (bookStep !== "paying") setBookOpen(false);
          }}
          exp={exp}
          step={bookStep}
          setStep={setBookStep}
          selectedSlot={selectedSlot}
          setSelectedSlotId={setSelectedSlotId}
          guestCount={guestCount}
          setGuestCount={setGuestCount}
          bookError={bookError}
          onConfirmPay={() => void confirmPay()}
          orderId={orderId}
          insetsBottom={insets.bottom}
          onViewJourney={() => {
            setBookOpen(false);
            router.push("/my-profile" as Href);
          }}
        />
      ) : null}
    </View>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={20} color={ACCENT} />
      <View style={styles.factCopy}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
    </View>
  );
}

function ReviewCard({ review }: { review: ExperienceReview }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHead}>
        <ExpoImage source={{ uri: review.authorPhotoUrl }} style={styles.reviewAvatar} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewName}>{review.authorName}</Text>
          <Text style={styles.reviewDate}>{review.dateLabel}</Text>
        </View>
        <View style={styles.reviewStars}>
          <Ionicons name="star" size={12} color={INK} />
          <Text style={styles.reviewRating}>{review.rating.toFixed(1)}</Text>
        </View>
      </View>
      <Text style={styles.reviewText}>{review.text}</Text>
    </View>
  );
}

function KnowBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.knowBlock}>
      <Text style={styles.knowTitle}>{title}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.knowBody}>
          · {item}
        </Text>
      ))}
    </View>
  );
}

function BookingSheet({
  visible,
  onClose,
  exp,
  step,
  setStep,
  selectedSlot,
  setSelectedSlotId,
  guestCount,
  setGuestCount,
  bookError,
  onConfirmPay,
  orderId,
  insetsBottom,
  onViewJourney,
}: {
  visible: boolean;
  onClose: () => void;
  exp: ExperienceDetail;
  step: BookingStep;
  setStep: (s: BookingStep) => void;
  selectedSlot: ExperienceAvailabilitySlot | null;
  setSelectedSlotId: (id: string) => void;
  guestCount: number;
  setGuestCount: React.Dispatch<React.SetStateAction<number>>;
  bookError: string | null;
  onConfirmPay: () => void;
  orderId: string | null;
  insetsBottom: number;
  onViewJourney: () => void;
}) {
  const maxGuests = selectedSlot?.spotsLeft ?? 8;
  const unit = selectedSlot?.priceCents ?? exp.priceCents;
  const priceBasis = exp.priceBasis;
  const priceCurrency = exp.currency || "EUR";
  const total = experienceBookingTotalCents(unit, guestCount, priceBasis);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable style={styles.sheetScrim} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: 16 + insetsBottom }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {step === "dates"
                ? "Choose a date"
                : step === "guests"
                  ? "Guests"
                  : step === "review" || step === "paying"
                    ? "Review booking"
                    : "Confirmed"}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={INK} />
            </Pressable>
          </View>

          {step === "dates" ? (
            <ScrollView style={styles.sheetScroll}>
              {exp.availability.map((slot) => (
                <Pressable
                  key={slot.id}
                  testID={`exp-booking-slot-${slot.id}`}
                  style={[
                    styles.sheetSlot,
                    selectedSlot?.id === slot.id && styles.sheetSlotOn,
                  ]}
                  onPress={() => {
                    setSelectedSlotId(slot.id);
                    setStep("guests");
                  }}
                >
                  <View>
                    <Text style={styles.sheetSlotLabel}>
                      {slot.label} · {slot.timeRange}
                    </Text>
                    <Text style={styles.sheetSlotMeta}>
                      {slot.spotsLeft} spots · {slot.language}
                    </Text>
                  </View>
                  <Text style={styles.sheetSlotPrice}>
                    {formatExperiencePrice(slot.priceCents, priceBasis, priceCurrency)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {step === "guests" && selectedSlot ? (
            <View style={styles.sheetBody}>
              <Text style={styles.sheetSlotLabel}>
                {selectedSlot.label} · {selectedSlot.timeRange}
              </Text>
              <View style={styles.guestRow}>
                <Text style={styles.guestLabel}>Guests</Text>
                <View style={styles.guestControls}>
                  <Pressable
                    style={styles.guestBtn}
                    onPress={() => setGuestCount((n) => Math.max(1, n - 1))}
                  >
                    <Text style={styles.guestBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.guestCount}>{guestCount}</Text>
                  <Pressable
                    style={styles.guestBtn}
                    onPress={() => setGuestCount((n) => Math.min(maxGuests, n + 1))}
                  >
                    <Text style={styles.guestBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={styles.guestHint}>Max {maxGuests} for this slot</Text>
              <Pressable style={styles.primaryBtn} onPress={() => setStep("review")}>
                <Text style={styles.primaryBtnText}>Review booking</Text>
              </Pressable>
              <Pressable onPress={() => setStep("dates")}>
                <Text style={styles.linkBack}>← Change date</Text>
              </Pressable>
            </View>
          ) : null}

          {(step === "review" || step === "paying") && selectedSlot ? (
            <View style={styles.sheetBody}>
              <Text style={styles.reviewLine}>{exp.title}</Text>
              <Text style={styles.reviewMeta}>
                {selectedSlot.label} · {selectedSlot.timeRange} · {selectedSlot.language}
              </Text>
              <Text style={styles.reviewMeta}>
                {guestCount} guest{guestCount === 1 ? "" : "s"} · Hosted by {exp.hostProfile.name}
              </Text>
              <Text style={styles.reviewMeta}>Meet · {exp.meeting.label}</Text>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {priceBasis === "per_person"
                    ? `${formatMoney(unit, priceCurrency)} × ${guestCount}`
                    : formatExperiencePrice(unit, priceBasis, priceCurrency)}
                </Text>
                <Text style={styles.totalValue}>{formatMoney(total, priceCurrency)}</Text>
              </View>
              <Text style={styles.commerceNote}>
                Checkout via Commerce OS · no local fake payment
              </Text>
              {bookError ? <Text style={styles.bookError}>{bookError}</Text> : null}
              <Pressable
                style={[styles.primaryBtn, step === "paying" && styles.primaryBtnDisabled]}
                disabled={step === "paying"}
                onPress={onConfirmPay}
              >
                {step === "paying" ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Pay with Commerce OS</Text>
                )}
              </Pressable>
              <Pressable disabled={step === "paying"} onPress={() => setStep("guests")}>
                <Text style={styles.linkBack}>← Change guests</Text>
              </Pressable>
            </View>
          ) : null}

          {step === "done" ? (
            <View style={styles.sheetBody}>
              <Ionicons name="checkmark-circle" size={48} color="#1A6B3C" />
              <Text style={styles.doneTitle}>You’re booked</Text>
              <Text style={styles.reviewMeta}>
                {exp.title} · {selectedSlot?.label} · {selectedSlot?.timeRange}
              </Text>
              {orderId ? <Text style={styles.orderId}>Order {orderId}</Text> : null}
              <Text style={styles.commerceNote}>
                Confirmation is live on My Journey · Notifications · Revenue Engine
              </Text>
              <Pressable style={styles.primaryBtn} onPress={onViewJourney}>
                <Text style={styles.primaryBtnText}>Open My Journey</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAPER },
  screen: { flex: 1, backgroundColor: PAPER },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: PAPER },
  missingText: { color: MUTED, fontSize: 16 },
  missingBack: { marginTop: 16 },
  missingBackText: { color: ACCENT, fontWeight: "700", fontSize: 15 },

  galleryWrap: { width: "100%", backgroundColor: PAPER },
  desktopGallery: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: 520,
    aspectRatio: ImageRatio.landscape,
  },
  desktopMain: {
    flex: 1.4,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: PAPER,
  },
  desktopSide: {
    flex: 1,
    gap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  desktopThumb: {
    width: "48%",
    flexGrow: 1,
    aspectRatio: ImageRatio.square,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: PAPER,
    minHeight: 120,
  },
  galleryCounter: {
    position: "absolute",
    right: 14,
    bottom: 18,
    backgroundColor: "rgba(26,26,26,0.72)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  galleryCounterText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  dots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" },
  dotOn: { backgroundColor: "#FFF", width: 16 },

  pad: { paddingHorizontal: 20, paddingVertical: 22 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: "#E5DFD4", marginHorizontal: 20 },

  categoryLine: {
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: INK,
    marginTop: 6,
    letterSpacing: -0.4,
    lineHeight: 34,
  },
  shortDesc: { fontSize: 16, lineHeight: 24, color: "#3A3630", marginTop: 12 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  ratingText: { fontSize: 14, fontWeight: "700", color: INK },

  hostRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  hostAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#E8E4DE" },
  hostCopy: { flex: 1 },
  hostBy: { fontSize: 17, fontWeight: "800", color: INK },
  hostExpertise: { fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 18 },
  hostLink: { fontSize: 13, fontWeight: "700", color: ACCENT, marginTop: 8 },

  sectionTitle: { fontSize: 20, fontWeight: "800", color: INK, marginBottom: 14, letterSpacing: -0.2 },
  sectionTitleInline: { fontSize: 20, fontWeight: "800", color: INK, letterSpacing: -0.2 },
  sectionLead: { fontSize: 14, color: MUTED, marginTop: -8, marginBottom: 14 },

  factsGrid: { gap: 16 },
  fact: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  factCopy: { flex: 1 },
  factLabel: { fontSize: 12, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 0.3 },
  factValue: { fontSize: 15, color: INK, marginTop: 2, lineHeight: 21 },

  itineraryStep: { flexDirection: "row", marginBottom: 18 },
  itineraryRail: { width: 28, alignItems: "center" },
  itineraryNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  itineraryNumText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  itineraryLine: { width: 2, flex: 1, backgroundColor: "#E5DFD4", marginVertical: 4 },
  itineraryBody: { flex: 1, flexDirection: "row", gap: 12, paddingBottom: 8 },
  itineraryThumb: { width: 88, height: 88, borderRadius: 12, backgroundColor: PAPER },
  itineraryCopy: { flex: 1 },
  itineraryTitle: { fontSize: 16, fontWeight: "800", color: INK },
  itineraryDur: { fontSize: 12, fontWeight: "600", color: ACCENT, marginTop: 2 },
  itineraryDesc: { fontSize: 14, lineHeight: 20, color: "#3A3630", marginTop: 6 },

  reviewsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  reviewCard: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5DFD4",
  },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E8E4DE" },
  reviewName: { fontSize: 14, fontWeight: "800", color: INK },
  reviewDate: { fontSize: 12, color: MUTED, marginTop: 1 },
  reviewStars: { flexDirection: "row", alignItems: "center", gap: 3 },
  reviewRating: { fontSize: 13, fontWeight: "700", color: INK },
  reviewText: { fontSize: 14, lineHeight: 21, color: "#3A3630" },
  showAllBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: INK,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  showAllText: { fontSize: 14, fontWeight: "700", color: INK },

  slotRail: { gap: 10, paddingRight: 8 },
  slotCard: {
    width: 168,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5DFD4",
    backgroundColor: "#FFF",
  },
  slotCardOn: { borderColor: INK, backgroundColor: "#1A1A1A" },
  slotLabel: { fontSize: 15, fontWeight: "800", color: INK },
  slotLabelOn: { color: "#FFF" },
  slotTime: { fontSize: 13, color: MUTED, marginTop: 4 },
  slotTimeOn: { color: "rgba(255,255,255,0.8)" },
  slotMeta: { fontSize: 12, color: MUTED, marginTop: 8 },
  slotMetaOn: { color: "rgba(255,255,255,0.7)" },
  slotPrice: { fontSize: 16, fontWeight: "800", color: INK, marginTop: 10 },
  slotPriceOn: { color: "#FFF" },

  meetingDesc: { fontSize: 15, lineHeight: 22, color: "#3A3630", marginBottom: 10 },
  meetingAddress: { fontSize: 14, fontWeight: "700", color: INK, lineHeight: 20 },
  meetingHint: { fontSize: 13, color: MUTED, marginTop: 6, marginBottom: 14 },
  mapWrap: { marginTop: 4 },

  hostAboutRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 4 },
  hostPortrait: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#E8E4DE",
  },
  hostAboutCopy: { flex: 1 },
  hostNameLg: { fontSize: 22, fontWeight: "800", color: INK },
  hostExpertiseLg: { fontSize: 14, color: MUTED, marginTop: 4 },
  hostBio: { fontSize: 15, lineHeight: 23, color: "#3A3630", marginTop: 14 },
  credList: { marginTop: 14, gap: 6 },
  credItem: { fontSize: 14, color: "#3A3630", lineHeight: 20 },
  hostYears: { fontSize: 13, color: MUTED, marginTop: 14 },
  hostActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: INK,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "700", color: INK },

  knowBlock: { marginBottom: 14 },
  knowTitle: { fontSize: 15, fontWeight: "800", color: INK, marginTop: 8, marginBottom: 6 },
  knowBody: { fontSize: 14, lineHeight: 21, color: "#3A3630", marginBottom: 2 },

  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
    backgroundColor: "rgba(255,252,248,0.92)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(229,223,212,0.9)",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
      default: {},
    }),
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5DFD4",
  },
  topCenter: { flex: 1, paddingHorizontal: 4 },
  topCat: { fontSize: 11, fontWeight: "700", color: ACCENT, textTransform: "uppercase" },
  topLoc: { fontSize: 13, fontWeight: "700", color: INK },

  bookBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#FFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5DFD4",
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: -2 } },
      android: { elevation: 8 },
      default: {},
    }),
  },
  bookBarLeft: { flex: 1 },
  bookPrice: { fontSize: 18, fontWeight: "800", color: INK },
  bookPer: { fontSize: 13, fontWeight: "600", color: MUTED },
  bookCancel: { fontSize: 12, color: MUTED, marginTop: 2 },
  bookCta: {
    backgroundColor: ACCENT,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 120,
    alignItems: "center",
  },
  bookCtaPreview: {
    backgroundColor: "#3A3530",
  },
  bookCtaText: { color: "#FFF", fontWeight: "800", fontSize: 15 },

  fsRoot: { flex: 1, backgroundColor: "#0A0908" },
  fsClose: { position: "absolute", top: 54, right: 16, zIndex: 2, padding: 8 },
  fsCounter: {
    position: "absolute",
    alignSelf: "center",
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },

  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D8D2C8",
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: INK },
  sheetScroll: { maxHeight: 360 },
  sheetBody: { paddingBottom: 8, gap: 10 },
  sheetSlot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5DFD4",
    marginBottom: 10,
  },
  sheetSlotOn: { borderColor: INK, backgroundColor: "#F7F4EF" },
  sheetSlotLabel: { fontSize: 15, fontWeight: "800", color: INK },
  sheetSlotMeta: { fontSize: 12, color: MUTED, marginTop: 3 },
  sheetSlotPrice: { fontSize: 16, fontWeight: "800", color: INK },
  guestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  guestLabel: { fontSize: 16, fontWeight: "700", color: INK },
  guestControls: { flexDirection: "row", alignItems: "center", gap: 14 },
  guestBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  guestBtnText: { fontSize: 20, fontWeight: "600", color: INK, lineHeight: 22 },
  guestCount: { fontSize: 18, fontWeight: "800", color: INK, minWidth: 24, textAlign: "center" },
  guestHint: { fontSize: 12, color: MUTED },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  linkBack: { marginTop: 12, color: ACCENT, fontWeight: "700", fontSize: 14 },
  reviewLine: { fontSize: 17, fontWeight: "800", color: INK },
  reviewMeta: { fontSize: 14, color: MUTED, lineHeight: 20 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5DFD4",
  },
  totalLabel: { fontSize: 15, color: MUTED },
  totalValue: { fontSize: 18, fontWeight: "800", color: INK },
  commerceNote: { fontSize: 12, color: MUTED, marginTop: 4 },
  bookError: {
    fontSize: 13,
    color: "#9B1C1C",
    backgroundColor: "#FDEBEC",
    padding: 12,
    borderRadius: 10,
    lineHeight: 18,
  },
  doneTitle: { fontSize: 22, fontWeight: "800", color: INK, marginTop: 8 },
  orderId: { fontSize: 12, color: MUTED, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
});
