/**
 * Guest App design tokens — bandiTour brand system.
 * WHITE canvas + BLACK structure + RED energy.
 * Blue must NOT be a primary brand/UI color.
 * Gold is micro-accent only (tiny perk / curated badges).
 * Water/ocean blue is allowed ONLY inside Impact drop visualization.
 */

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Typography scale — names have authority; metadata stays quiet. */
export const type = {
  pageTitle: { fontSize: 30, fontWeight: '700' as const, lineHeight: 36 },
  pageTitleMobile: { fontSize: 26, fontWeight: '700' as const, lineHeight: 32 },
  cardName: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  cardNameMobile: { fontSize: 18, fontWeight: '700' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySm: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  meta: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  metaSm: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  cta: { fontSize: 14, fontWeight: '600' as const, lineHeight: 18 },
  ctaSm: { fontSize: 13, fontWeight: '600' as const, lineHeight: 16 },
  nav: { fontSize: 13, fontWeight: '600' as const, lineHeight: 16 },
  navActive: { fontSize: 13, fontWeight: '700' as const, lineHeight: 16 },
} as const;

/**
 * Official bandiTour palette.
 * Prefer these tokens over hard-coded hex in screens.
 */
export const color = {
  /** Near-black structure */
  ink: '#111111',
  charcoal: '#181818',
  inkSoft: '#3C3C3C',
  muted: '#6B6B6B',
  hairline: '#E8E8E8',
  /** White / warm off-white canvas */
  surface: '#FFFFFF',
  surfaceWarm: '#FAF9F7',
  surfaceSoft: '#F7F7F7',
  imageFallback: '#1A1A1A',
  /** Signature bandiTour red — interaction, active, CTA */
  brand: '#E03131',
  cityGuide: '#E03131',
  /** Nav / tint — black active text; red used for underline via `brand` */
  tint: '#111111',
  follow: '#111111',
  /** Octopus Concierge — charcoal + white + small red accent (no blue) */
  octopusDeep: '#181818',
  octopusBorder: 'rgba(224, 49, 49, 0.45)',
  octopusText: '#FFFFFF',
  octopusAccent: '#E03131',
  /** Micro gold — tiny curated / perk badges ONLY */
  goldMicro: '#C9A227',
  star: '#C9A227',
  /** Semantic status only (not brand) */
  statusGreen: '#1A6B3C',
  /** Impact water visualization ONLY — never page chrome */
  waterDeep: '#0A4A5C',
  waterMid: '#1A7A8C',
  waterLight: '#5BB8C9',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

/** Shared premium card language */
export const card = {
  radius: radius.xl,
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  /** Web box-shadow string for platforms that prefer CSS */
  shadowWeb: '0 4px 20px rgba(0,0,0,0.10)',
  imageRadius: radius.xl,
  hoverLift: 2,
} as const;

export const layout = {
  contentMax: 1160,
  profileHeroDesktopH: 460,
  /** List card portrait: mobile 4:5; desktop uses 5:4 inline in BanditHeader. */
  listHeroRatio: 4 / 5,
  galleryMainRatio: 4 / 3,
  desktopBreak: 900,
} as const;

/** Re-export image-ratio system — import from here or `@/lib/imageRatios`. */
export {
  ImageRatio,
  cardWidthForColumns,
  imageFocusStyle,
  landscapeCardMinHeight,
  offerMarketplaceColumns,
  portraitCardMinHeight,
  portraitMarketplaceColumns,
  ratioFrameStyle,
  ratioImageStyle,
  shopMarketplaceColumns,
} from '@/lib/imageRatios';

/** Stable display follower count when DB has none — not a live metric. */
export function displayFollowerCount(seed: string): number {
  let h = 0;
  const s = String(seed || 'bandit');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 48 + (h % 220);
}

export function firstNameOf(name: string | null | undefined): string {
  return String(name || '').trim().split(/\s+/)[0] || 'banDit';
}

export function shortIntro(text: string | null | undefined, max = 160): string {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const last = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '));
  return `${(last > 60 ? cut.slice(0, last) : cut).trim()}…`;
}
