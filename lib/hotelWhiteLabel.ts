import type { ImageSourcePropType } from 'react-native';

export type HotelSlug = 'play-theatrou' | 'nyx-athens' | 'aluma-athens';

export type HotelWhiteLabelConfig = {
  slug: HotelSlug;
  hotelId: string;
  displayName: string;
  title: string;
  /** When `logo`, guest-facing screens must show the official logo image instead of spelling the brand in UI type. */
  titlePresentation?: 'text' | 'logo';
  groupName: string;
  subtitle: string;
  introTapLabel: string;
  welcomeBodyPrimary: string;
  welcomeBodySecondary: string;
  logoSource: ImageSourcePropType;
  brandMarkSource: ImageSourcePropType;
  introHeroSource: ImageSourcePropType;
  welcomeHeroSource: ImageSourcePropType;
  messageBackgroundSource: ImageSourcePropType;
  giftBackgroundSource: ImageSourcePropType;
  /** Main `/bandits` hero — same layout for all hotels; only these strings and assets differ. */
  homeBanditsBannerTag: string;
  homeHeroEyebrow: string;
  homeHeroHeadline: string;
  homeInspirationLines: readonly string[];
  /** Menu: line under "Guest Menu" */
  menuLocationLine: string;
  profileGuestIdentity: string;
  profileAccessTitle: string;
  profileAccessBullets: string;
};

const BANDITOUR_LOGO = require('@/assets/icons/logobanditourapp.png');
const PLAY_ATHENS_BG = require('@/assets/images/play_athens_bg.png');
/** PLAY Theatrou property / intro backdrop — keep filename aligned with `assets/images/play-theatrou.png`. */
const PLAY_THEATROU_HERO = require('@/assets/images/play-theatrou.png');
const PLAY_PSYRI_MARK = require('@/assets/images/play-psyri.png');
const BOTTLE_SKY = require('@/assets/images/brand/banditour-bottle-sky.png');
const BOTTLE_ALPINE = require('@/assets/images/brand/banditour-bottle-alpine.png');

/**
 * PLAY guest-flow bottle image. Swap this `require(...)` when final PLAY bottle art ships.
 * Kept separate from NYX/ALUMA mapping in `getHotelBottleAsset`.
 */
export const PLAY_HOTEL_BOTTLE_ASSET: ImageSourcePropType = BOTTLE_SKY;

/** NYX branded bottle — replace `assets/images/hotels/nyx/bottle.png` with final art when ready. */
export const NYX_HOTEL_BOTTLE_ASSET: ImageSourcePropType = require('@/assets/images/hotels/nyx/bottle.png');

/**
 * ALUMA guest-flow bottle — must be the attached branded bottle PNG.
 * Replace the file at this path with your approved asset; keep the same filename.
 */
export const ALUMA_HOTEL_BOTTLE_ASSET: ImageSourcePropType = require('@/assets/images/hotels/aluma/bottle.png');

/**
 * Unified mechanic label — Side A across all white-label hotels.
 * Curated welcome in a bottle (no “real user sent it” claim).
 */
export const MESSAGE_IN_BOTTLE_EYEBROW = 'Message in a Bottle' as const;

/** PLAY — lifestyle / energy / nightlife (Athens theatrical). */
export const PLAY_BOTTLE_SIDE_A = {
  headline: 'A message in a bottle has arrived for you.',
  body:
    'Welcome, beautiful days are waiting. A warm welcome to the holiday mood, a smile moment, a short line of travel energy. Open when you are ready.',
  revealCta: 'Open your bottle',
} as const;

export const PLAY_BOTTLE_SIDE_B = {
  eyebrow: 'YOUR ARRIVAL GIFT',
  title: 'Your welcome is waiting at reception.',
  body: 'Show this screen at the desk to collect what was set aside for your first night.',
  giftCta: 'Claim your gift',
  giftFooter: 'Held for you at the desk.',
} as const;

/** NYX — urban / sharp / insider city (after-dark). */
export const NYX_BOTTLE_SIDE_A = {
  headline: 'A message in a bottle has arrived for you.',
  body:
    'Smart travel energy, a warm welcome, a small spark before you step out. The night is open. Open the bottle when you like.',
  revealCta: 'Open your bottle',
} as const;

export const NYX_BOTTLE_SIDE_B = {
  eyebrow: 'YOUR ARRIVAL GIFT',
  title: 'Your welcome is ready downstairs.',
  body: 'Present this screen at reception to pick up your arrival gift before you head out.',
  giftCta: 'Show at reception',
} as const;

/** ALUMA — luxury / refined / intimate. Brand mark is always `logoSource` image, not typed “ALUMA”. */
export const ALUMA_MESSAGE_IN_BOTTLE = {
  eyebrow: 'You were noticed.',
  headline: 'A message in a bottle has arrived for you.',
  revealCta: 'Open your bottle',
} as const;

/** Shared short lines for ALUMA entry + welcome (no long hotel subtitle). */
export const ALUMA_GUEST_ENTRY_COPY = {
  headline: 'A message in a bottle has arrived for you.',
  subline: 'A curated welcome, written for a calm start in Athens.',
} as const;

/** Reserved for hotelier / internal tooltips — not used on guest flip cards. */
export const ALUMA_FLIP_UX = {
  networkRibbon: '',
  senderLine: '',
  socialFlowStep1: 'Signal',
  socialFlowStep2: 'Sender',
  socialFlowStep3: 'Connect',
  giftUnlockedLine: 'Your welcome was unlocked with this note.',
  bottleOrigin: 'Curated welcome, not standard hotel text.',
  anticipation: 'Short. Personal. Live.',
  giftUnlockEyebrow: 'NETWORK LINK',
  giftUnlockTitle: 'Arrival gift',
  giftUnlockBody: 'Signal received. Gift is ready at reception.',
} as const;

export const ALUMA_WELCOME_GIFT_CARD = {
  eyebrow: 'YOUR ARRIVAL GIFT',
  title: 'Your welcome gift is ready.',
  body: 'Show this at reception.',
  detail: '',
  giftCta: 'Collect now',
} as const;

const ALUMA_LOGO = require('@/assets/images/hotels/aluma/logo.png');
/** Full-bleed property photography for ALUMA flows (intro, welcome, flip). */
const ALUMA_PROPERTY_HERO = require('@/assets/images/hotels/aluma/hero.png');
const NYX_LOGO = require('@/assets/images/hotels/nyx/logo.png');
/** Full-bleed NYX Athens imagery (intro, welcome, flip backgrounds). Swap file in-repo to change mood. */
const NYX_HERO = require('@/assets/images/hotels/nyx/hero.png');

export const HOTEL_WHITE_LABELS: Record<HotelSlug, HotelWhiteLabelConfig> = {
  'play-theatrou': {
    slug: 'play-theatrou',
    hotelId: '00000000-0000-4000-8000-000000000001',
    displayName: 'PLAY Theatrou',
    title: 'PLAY Theatrou Athens',
    groupName: 'Israel Canada Group',
    subtitle: 'A message in a bottle has arrived for you.',
    introTapLabel: 'Continue to your message',
    welcomeBodyPrimary: "A message in a bottle has arrived for you.\nWarm, bright, a little city magic, a moment just to say welcome.",
    welcomeBodySecondary: 'Local hosts · living city energy · just for you.',
    logoSource: BANDITOUR_LOGO,
    brandMarkSource: PLAY_PSYRI_MARK,
    introHeroSource: PLAY_THEATROU_HERO,
    welcomeHeroSource: BOTTLE_ALPINE,
    /** Athens boutique mood — calmer than bottle art for message/gift screens */
    messageBackgroundSource: PLAY_ATHENS_BG,
    giftBackgroundSource: PLAY_ATHENS_BG,
    homeBanditsBannerTag: 'Safety signal · local intel · for PLAY guests & neighbors',
    homeHeroEyebrow: 'PLAY · ATHENS',
    homeHeroHeadline: 'Your night, curated.',
    homeInspirationLines: [
      'Athens today: theatre, light, and late-night energy — follow what pulls you.',
      'Your PLAY night starts with one honest recommendation — then the city opens up.',
      'Psyri to Monastiraki and back: small streets, big moods. Let curiosity lead.',
      'A good guest leaves room for surprise — start here, then wander.',
    ] as const,
    menuLocationLine: 'PLAY Theatrou Athens',
    profileGuestIdentity: 'This is your guest identity for bandiTour city access.',
    profileAccessTitle: 'PLAY guest access',
    profileAccessBullets:
      '· Local banDits recommendations by neighborhood\n· City routes with map context and live spots\n· Local Friend requests and replies in Inbox',
  },
  'nyx-athens': {
    slug: 'nyx-athens',
    hotelId: '00000000-0000-4000-8000-000000000002',
    displayName: 'NYX Athens',
    title: 'NYX Athens',
    groupName: 'Fattal',
    subtitle: 'The city already knows you landed.',
    introTapLabel: 'Continue to your message',
    welcomeBodyPrimary: "You landed—and the night layer already knows.\nYour opening move is waiting.",
    welcomeBodySecondary: 'Insiders nearby · after-dark energy · yours to unlock.',
    logoSource: NYX_LOGO,
    brandMarkSource: NYX_LOGO,
    introHeroSource: NYX_HERO,
    welcomeHeroSource: NYX_HERO,
    messageBackgroundSource: NYX_HERO,
    giftBackgroundSource: NYX_HERO,
    homeBanditsBannerTag: 'After-dark energy · local intel · for NYX guests',
    homeHeroEyebrow: 'NYX · ATHENS',
    homeHeroHeadline: 'Your city layer, unlocked.',
    homeInspirationLines: [
      'Athens after dark: side streets, rooftops, and a pulse you can’t fake.',
      'Start with one sharp pick — the night will suggest the next.',
      'Kolonaki to Kerameikos: the city rewards curiosity.',
      'A good night leaves room for one more turn.',
    ] as const,
    menuLocationLine: 'NYX Athens',
    profileGuestIdentity: 'This is your guest identity for bandiTour city access.',
    profileAccessTitle: 'NYX guest access',
    profileAccessBullets:
      '· Local banDits recommendations by neighborhood\n· City routes with map context and live spots\n· Local Friend requests and replies in Inbox',
  },
  'aluma-athens': {
    slug: 'aluma-athens',
    hotelId: '00000000-0000-4000-8000-000000000003',
    displayName: 'Athens hospitality partner',
    title: 'Athens hospitality partner',
    titlePresentation: 'logo',
    groupName: 'Isrotel',
    subtitle: 'A message in a bottle has arrived for you.',
    introTapLabel: 'Continue to your message',
    welcomeBodyPrimary: 'A message in a bottle has arrived for you.\nCalm, personal, a soft welcome before you go explore.',
    welcomeBodySecondary: '',
    logoSource: ALUMA_LOGO,
    brandMarkSource: ALUMA_LOGO,
    introHeroSource: ALUMA_PROPERTY_HERO,
    welcomeHeroSource: ALUMA_PROPERTY_HERO,
    messageBackgroundSource: ALUMA_PROPERTY_HERO,
    giftBackgroundSource: ALUMA_PROPERTY_HERO,
    homeBanditsBannerTag: 'Calm curation · local signal · for hotel guests in Athens',
    homeHeroEyebrow: 'ATHENS',
    homeHeroHeadline: 'Your evening, quietly elevated.',
    homeInspirationLines: [
      'A soft start in Athens: light, stone, and room to breathe before you go out.',
      'Calm energy first — one honest pick can open the whole map.',
      'Kolonaki, Plaka, the hills: the city is patient for guests who listen.',
      'A lovely guest leaves a little room for the unexpected.',
    ] as const,
    menuLocationLine: 'Athens hospitality partner',
    profileGuestIdentity: 'This is your guest identity for bandiTour city access.',
    profileAccessTitle: 'Guest access',
    profileAccessBullets:
      '· Local banDits recommendations by neighborhood\n· City routes with map context and live spots\n· Local Friend requests and replies in Inbox',
  },
};

export const DEFAULT_HOTEL_SLUG: HotelSlug = 'play-theatrou';

export function normalizeHotelSlug(value: string | null | undefined): string {
  const norm = String(value ?? '')
    .trim()
    .toLowerCase();
  // Public-facing path aliases (QR / printed URLs must match these segments).
  if (norm === 'play-athens') return 'play-theatrou';
  /** Branded path used on cards; canonical slug remains `nyx-athens`. */
  if (norm === 'nyx-theatrou') return 'nyx-athens';
  return norm;
}

export function isKnownHotelSlug(value: string | null | undefined): value is HotelSlug {
  const norm = normalizeHotelSlug(value);
  return norm in HOTEL_WHITE_LABELS;
}

export function getHotelWhiteLabel(value: string | null | undefined): HotelWhiteLabelConfig | null {
  const norm = normalizeHotelSlug(value);
  if (!isKnownHotelSlug(norm)) return null;
  return HOTEL_WHITE_LABELS[norm];
}

export function getHotelWhiteLabelOrDefault(value: string | null | undefined): HotelWhiteLabelConfig {
  return getHotelWhiteLabel(value) ?? HOTEL_WHITE_LABELS[DEFAULT_HOTEL_SLUG];
}

/**
 * Deterministic per-hotel bottle art for the guest intro flow.
 * Returns `null` for unknown slugs (no PLAY fallback).
 */
export function getHotelBottleAsset(slug: string | null | undefined): ImageSourcePropType | null {
  const norm = normalizeHotelSlug(slug);
  if (norm === 'play-theatrou') return PLAY_HOTEL_BOTTLE_ASSET;
  if (norm === 'nyx-athens') return NYX_HOTEL_BOTTLE_ASSET;
  if (norm === 'aluma-athens') return ALUMA_HOTEL_BOTTLE_ASSET;
  return null;
}
