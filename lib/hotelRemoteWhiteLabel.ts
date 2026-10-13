/**
 * Dynamic hotel white-label from Partner Platform tenant DB.
 * Hotel #N onboards without adding HOTEL_WHITE_LABELS entries.
 */

import type { ImageSourcePropType } from 'react-native';

import { partnerPlatformOrigin } from '@/lib/orchestra/client';
import { workspaceOrigin } from '@/lib/workspace/client';
import {
  DEFAULT_HOTEL_SLUG,
  HOTEL_WHITE_LABELS,
  getHotelWhiteLabel,
  isKnownHotelSlug,
  normalizeHotelSlug,
  type HotelSlug,
  type HotelWhiteLabelConfig,
} from '@/lib/hotelWhiteLabel';

export type RemoteHotelWhiteLabelPayload = {
  displayName: string;
  title: string;
  groupName: string;
  subtitle: string;
  destination: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  heroUrl: string;
  brandMarkUrl: string;
  introTapLabel: string;
  welcomeBodyPrimary: string;
  welcomeBodySecondary: string;
  homeBanditsBannerTag: string;
  homeHeroEyebrow: string;
  homeHeroHeadline: string;
  homeInspirationLines: string[];
  menuLocationLine: string;
  profileGuestIdentity: string;
  profileAccessTitle: string;
  profileAccessBullets: string;
};

export type RemoteHotelConfig = {
  hotelId: string;
  slug: string;
  name: string;
  location: string;
  whiteLabel: RemoteHotelWhiteLabelPayload;
  guestEntryUrl: string;
  source: 'tenant_db';
};

type CacheEntry = {
  config: RemoteHotelConfig;
  resolved: HotelWhiteLabelConfig;
  fetchedAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const memoryCache = new Map<string, CacheEntry>();

function uriSource(url: string | undefined, fallback: ImageSourcePropType): ImageSourcePropType {
  const u = String(url || '').trim();
  if (u && /^https?:\/\//i.test(u)) return { uri: u };
  return fallback;
}

function fallbackAssets(): Pick<
  HotelWhiteLabelConfig,
  | 'logoSource'
  | 'brandMarkSource'
  | 'introHeroSource'
  | 'welcomeHeroSource'
  | 'messageBackgroundSource'
  | 'giftBackgroundSource'
> {
  const play = HOTEL_WHITE_LABELS[DEFAULT_HOTEL_SLUG];
  return {
    logoSource: play.logoSource,
    brandMarkSource: play.brandMarkSource,
    introHeroSource: play.introHeroSource,
    welcomeHeroSource: play.welcomeHeroSource,
    messageBackgroundSource: play.messageBackgroundSource,
    giftBackgroundSource: play.giftBackgroundSource,
  };
}

export function remotePayloadToWhiteLabel(
  slug: string,
  hotelId: string,
  wl: RemoteHotelWhiteLabelPayload,
): HotelWhiteLabelConfig {
  const assets = fallbackAssets();
    const lines =
    Array.isArray(wl.homeInspirationLines) && wl.homeInspirationLines.length
      ? wl.homeInspirationLines
      : ([
          'Your stay starts with one honest recommendation — then the city opens up.',
          'Start with one local pick — the day will suggest the next.',
          'A good guest leaves room for surprise — start here, then wander.',
          'Follow what pulls you. The city will meet you halfway.',
        ] as const);

  return {
    slug: slug as HotelSlug,
    hotelId,
    displayName: wl.displayName || slug,
    title: wl.title || wl.displayName || slug,
    groupName: wl.groupName || '',
    subtitle: wl.subtitle || 'A message in a bottle has arrived for you.',
    introTapLabel: wl.introTapLabel || 'Continue to your message',
    welcomeBodyPrimary: wl.welcomeBodyPrimary || `Welcome to ${wl.displayName || slug}.`,
    welcomeBodySecondary: wl.welcomeBodySecondary || '',
    logoSource: uriSource(wl.logoUrl, assets.logoSource),
    brandMarkSource: uriSource(wl.brandMarkUrl || wl.logoUrl, assets.brandMarkSource),
    introHeroSource: uriSource(wl.heroUrl, assets.introHeroSource),
    welcomeHeroSource: uriSource(wl.heroUrl, assets.welcomeHeroSource),
    messageBackgroundSource: uriSource(wl.heroUrl, assets.messageBackgroundSource),
    giftBackgroundSource: uriSource(wl.heroUrl, assets.giftBackgroundSource),
    homeBanditsBannerTag: wl.homeBanditsBannerTag || `Local intel · for ${wl.displayName || slug} guests`,
    homeHeroEyebrow: wl.homeHeroEyebrow || (wl.destination || '').toUpperCase() || 'GUEST',
    homeHeroHeadline: wl.homeHeroHeadline || 'Your stay, curated.',
    homeInspirationLines: lines as HotelWhiteLabelConfig['homeInspirationLines'],
    menuLocationLine: wl.menuLocationLine || wl.displayName || slug,
    profileGuestIdentity: wl.profileGuestIdentity || 'This is your guest identity for bandiTour city access.',
    profileAccessTitle: wl.profileAccessTitle || 'Guest access',
    profileAccessBullets:
      wl.profileAccessBullets ||
      '· Local banDits recommendations by neighborhood\n· City routes with map context and live spots\n· Local Friend requests and replies in Notifications',
  };
}

export async function fetchRemoteHotelConfig(slug: string): Promise<RemoteHotelConfig | null> {
  const norm = normalizeHotelSlug(slug);
  if (!norm) return null;

  const cached = memoryCache.get(norm);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.config;
  }

  const bases = [partnerPlatformOrigin(), workspaceOrigin()].filter(Boolean).map((o) => String(o).replace(/\/$/, ''));
  if (!bases.length && __DEV__) bases.push('http://localhost:3000');

  for (const origin of bases) {
    try {
      const res = await fetch(
        `${origin}/api/public/hotels/${encodeURIComponent(norm)}/config`,
        { headers: { Accept: 'application/json' } },
      );
      if (!res.ok) continue;
      const json = (await res.json()) as {
        ok?: boolean;
        hotelId?: string;
        slug?: string;
        name?: string;
        location?: string;
        guestEntryUrl?: string;
        whiteLabel?: RemoteHotelWhiteLabelPayload;
        hotel?: {
          hotelId: string;
          slug: string;
          name: string;
          location: string;
          whiteLabel: RemoteHotelWhiteLabelPayload;
          guestEntryUrl: string;
        };
      };

      // Workspace flat shape OR Partner nested `{ hotel }` shape
      const hotel = json.hotel
        ? json.hotel
        : json.ok && json.slug && json.whiteLabel
          ? {
              hotelId: String(json.hotelId || ''),
              slug: json.slug,
              name: String(json.name || json.slug),
              location: String(json.location || ''),
              whiteLabel: json.whiteLabel,
              guestEntryUrl: String(json.guestEntryUrl || ''),
            }
          : null;
      if (!hotel?.slug || !hotel.whiteLabel) continue;

      const config: RemoteHotelConfig = {
        hotelId: hotel.hotelId,
        slug: hotel.slug,
        name: hotel.name,
        location: hotel.location,
        whiteLabel: hotel.whiteLabel,
        guestEntryUrl: hotel.guestEntryUrl,
        source: 'tenant_db',
      };
      const resolved = remotePayloadToWhiteLabel(config.slug, config.hotelId, config.whiteLabel);
      memoryCache.set(norm, { config, resolved, fetchedAt: Date.now() });
      memoryCache.set(config.slug, { config, resolved, fetchedAt: Date.now() });
      return config;
    } catch {
      /* try next origin */
    }
  }
  return null;
}

export function getCachedRemoteWhiteLabel(slug: string | null | undefined): HotelWhiteLabelConfig | null {
  const norm = normalizeHotelSlug(slug);
  const entry = memoryCache.get(norm);
  return entry?.resolved ?? null;
}

/**
 * Resolve branding: local compile-time hotels first, then remote tenant cache/API.
 * Does NOT silently fall back to PLAY for unknown remote-capable slugs when `allowPlayFallback` is false.
 */
export async function resolveHotelWhiteLabel(
  slug: string | null | undefined,
  opts?: { allowPlayFallback?: boolean },
): Promise<{
  config: HotelWhiteLabelConfig;
  source: 'local' | 'remote' | 'play_fallback';
  remote: RemoteHotelConfig | null;
}> {
  const norm = normalizeHotelSlug(slug);
  const local = getHotelWhiteLabel(norm);
  if (local) {
    return { config: local, source: 'local', remote: null };
  }

  const remote = await fetchRemoteHotelConfig(norm);
  if (remote) {
    const config = remotePayloadToWhiteLabel(remote.slug, remote.hotelId, remote.whiteLabel);
    return { config, source: 'remote', remote };
  }

  const cached = getCachedRemoteWhiteLabel(norm);
  if (cached) {
    return { config: cached, source: 'remote', remote: null };
  }

  if (opts?.allowPlayFallback === false) {
    // Minimal placeholder — caller should show "hotel not found"
    const play = HOTEL_WHITE_LABELS[DEFAULT_HOTEL_SLUG];
    return {
      config: {
        ...play,
        slug: (norm || 'unknown') as HotelSlug,
        hotelId: '',
        displayName: norm || 'Unknown hotel',
        title: norm || 'Unknown hotel',
      },
      source: 'play_fallback',
      remote: null,
    };
  }

  return {
    config: HOTEL_WHITE_LABELS[DEFAULT_HOTEL_SLUG],
    source: 'play_fallback',
    remote: null,
  };
}

/** True if slug is compile-time known OR successfully resolved from Partner Platform. */
export async function isResolvableHotelSlug(slug: string | null | undefined): Promise<boolean> {
  const norm = normalizeHotelSlug(slug);
  if (isKnownHotelSlug(norm)) return true;
  const remote = await fetchRemoteHotelConfig(norm);
  return Boolean(remote);
}
