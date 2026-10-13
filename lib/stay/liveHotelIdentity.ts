/**
 * Live guest hotel identity — never silently substitute PLAY / seed hotels.
 * Isolated PLAY sandbox fixtures stay in HOTEL_WHITE_LABELS + guest-lifecycle seedBundle.
 */

import {
  getHotelWhiteLabel,
  normalizeHotelSlug,
  type HotelWhiteLabelConfig,
} from '@/lib/hotelWhiteLabel';
import { getCachedRemoteWhiteLabel, resolveHotelWhiteLabel } from '@/lib/hotelRemoteWhiteLabel';
import type { HotelEntry } from '@/lib/pilotSession';

export const PLAY_SANDBOX_SLUG = 'play-theatrou';

export function isIsolatedPlaySandboxSlug(slug: string | null | undefined): boolean {
  const n = normalizeHotelSlug(slug);
  return n === 'play-theatrou' || n === 'play-athens';
}

/** True when copy/identity is a PLAY seed that must not appear in a live guest session. */
export function isPlaySeedLeakText(value: string | null | undefined): boolean {
  const t = String(value || '');
  if (!t) return false;
  return /PLAY-DEMO-001|PLAY-ATH-|PLAY · ATHENS|PLAY Theatrou|PLAY-Guest|playtheatrou|PLAY-402/i.test(
    t,
  );
}

export function liveHotelDisplayName(opts: {
  stayName?: string | null;
  entry?: HotelEntry | null;
  slug?: string | null;
}): string {
  const stay = String(opts.stayName || '').trim();
  if (stay && !isPlaySeedLeakText(stay)) return stay;
  if (stay && isIsolatedPlaySandboxSlug(opts.slug || opts.entry?.slug)) return stay;
  const fromEntry = String(opts.entry?.displayName || '').trim();
  if (fromEntry && !isPlaySeedLeakText(fromEntry)) return fromEntry;
  if (fromEntry && isIsolatedPlaySandboxSlug(opts.entry?.slug)) return fromEntry;
  const slug = normalizeHotelSlug(opts.slug || opts.entry?.slug);
  const local = getHotelWhiteLabel(slug);
  if (local) return local.displayName;
  const remote = getCachedRemoteWhiteLabel(slug);
  if (remote?.displayName) return remote.displayName;
  if (stay) return stay;
  if (fromEntry) return fromEntry;
  return '';
}

export async function resolveUnlockHotelBranding(opts: {
  slug: string | null | undefined;
  liveHotelName?: string | null;
}): Promise<{
  config: HotelWhiteLabelConfig | null;
  source: 'local' | 'remote' | 'live_name' | 'none';
}> {
  const slug = normalizeHotelSlug(opts.slug);
  const liveName = String(opts.liveHotelName || '').trim();

  if (!slug && !liveName) {
    return { config: null, source: 'none' };
  }

  const resolved = slug
    ? await resolveHotelWhiteLabel(slug, { allowPlayFallback: false })
    : null;

  if (resolved?.source === 'local' || resolved?.source === 'remote') {
    return { config: resolved.config, source: resolved.source };
  }

  if (resolved?.source === 'play_fallback' && isIsolatedPlaySandboxSlug(slug) && !liveName) {
    return { config: resolved.config, source: 'local' };
  }

  if (liveName || slug) {
    const playAssets = resolved?.config;
    const display = liveName || slug;
    if (!playAssets) {
      return { config: null, source: 'live_name' };
    }
    return {
      source: 'live_name',
      config: {
        ...playAssets,
        slug: (slug || playAssets.slug) as HotelWhiteLabelConfig['slug'],
        hotelId: '',
        displayName: display,
        title: display,
        homeHeroEyebrow: '',
        homeHeroHeadline: 'Your stay, curated.',
        homeBanditsBannerTag: `Local intel · for ${display} guests`,
        menuLocationLine: display,
        profileAccessTitle: 'Guest access',
        homeInspirationLines: [
          'Your stay starts with one honest recommendation — then the city opens up.',
          'Start with one local pick — the day will suggest the next.',
          'A good guest leaves room for surprise — start here, then wander.',
          'Follow what pulls you. The city will meet you halfway.',
        ] as HotelWhiteLabelConfig['homeInspirationLines'],
      },
    };
  }

  return { config: null, source: 'none' };
}
