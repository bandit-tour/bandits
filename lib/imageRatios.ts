/**
 * Guest App image-ratio system — system law.
 *
 * Locked ratios for photography content cards:
 * - Portrait 4:5 (preferred) / 3:4 — people, hosts, experiences, lifestyle
 * - Square 1:1 — shop, collections, compact merchant
 * - Landscape 4:3 / 3:2 — rooms, lodging, restaurant interiors (never shallow strips)
 *
 * FORBIDDEN as listing default: ultra-wide banners, thin horizontal strips,
 * face-cropping panoramas, full-width shallow rectangles.
 */

import { Platform, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

/** Local tokens — avoid importing `@/lib/guestDesign` (circular re-export). */
const IMAGE_FALLBACK = '#1A1A1A';
const FRAME_RADIUS = 20;

export const ImageRatio = {
  /** People / experiences / editorial — preferred */
  portrait: 4 / 5,
  /** Alternate portrait */
  portraitAlt: 3 / 4,
  /** Shop / collections / compact */
  square: 1,
  /** Lodging / rooms / interiors — balanced, not a strip */
  landscape: 4 / 3,
  /** Slightly wider place context when justified */
  landscapeWide: 3 / 2,
} as const;

export type ImageRatioKey = keyof typeof ImageRatio;

/** Focal point for cover crops — faces prefer center-top. */
export type ImageFocus = 'center' | 'center-top' | 'top';

export const imageFocusStyle = (focus: ImageFocus = 'center-top'): ImageStyle => {
  const webPos =
    focus === 'center'
      ? 'center center'
      : focus === 'top'
        ? 'center top'
        : 'center top';
  return Platform.select({
    web: {
      objectFit: 'cover',
      objectPosition: webPos,
    } as ImageStyle,
    default: {},
  }) as ImageStyle;
};

/** Frame style: width + locked aspect ratio + rounded overflow host. */
export function ratioFrameStyle(
  ratio: number,
  extras?: StyleProp<ViewStyle>,
): StyleProp<ViewStyle> {
  return [
    {
      width: '100%',
      aspectRatio: ratio,
      overflow: 'hidden',
      backgroundColor: IMAGE_FALLBACK,
      borderRadius: FRAME_RADIUS,
    },
    extras,
  ];
}

/** Absolute-fill cover image inside a ratio frame. */
export function ratioImageStyle(focus: ImageFocus = 'center-top'): StyleProp<ImageStyle> {
  return [
    {
      width: '100%',
      height: '100%',
    },
    imageFocusStyle(focus),
  ];
}

/** Marketplace column counts — Experiences / editorial portrait grids. */
export function portraitMarketplaceColumns(width: number): number {
  if (width >= 1100) return 4;
  if (width >= 820) return 3;
  if (width >= 560) return 2;
  return 1;
}

/** SmartTraveler / lodging — 3-up desktop. */
export function offerMarketplaceColumns(width: number): number {
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

/** Shop — dense 3–4 desktop. */
export function shopMarketplaceColumns(width: number): number {
  if (width >= 1100) return 4;
  if (width >= 720) return 3;
  return 2;
}

export function cardWidthForColumns(
  width: number,
  columns: number,
  pad = 16,
  gap = 14,
): number {
  return (width - pad * 2 - gap * (columns - 1)) / columns;
}

/** Min image height for 4:3 offer cards (~190–220 on typical desktop card). */
export function landscapeCardMinHeight(cardWidth: number): number {
  return Math.max(190, Math.min(240, cardWidth * (3 / 4)));
}

/** Min image height for 4:5 portrait local-find cards. */
export function portraitCardMinHeight(cardWidth: number): number {
  return Math.max(220, Math.min(360, cardWidth * (5 / 4)));
}
