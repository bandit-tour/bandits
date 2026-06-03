import type { Href, Router } from 'expo-router';

import { upperTabHref, type UpperTabKey } from '@/lib/upperTab';

/** Main PLAY tab home (Local banDits). */
export const APP_HOME_HREF = '/bandits' as Href;

/** Guest / staff PLAY menu tab. */
export const PLAY_MENU_HREF = '/menu' as Href;

/** Operator thread reply opened from Notifications / Pilot Desk. */
export const OPERATOR_CHAT_HREF = '/chat' as Href;

export type AppNavigationRouter = Pick<Router, 'replace' | 'push' | 'back' | 'canGoBack'>;

export type LowerTabKey = 'home' | 'localFriend' | 'chat' | 'alerts' | 'notifications' | 'menu';

export type LowerTabHref =
  | '/bandits'
  | '/mySpots'
  | '/explore'
  | '/localFriend'
  | '/community'
  | '/alerts'
  | '/notifications'
  | '/menu';

/**
 * Bottom-nav highlight from pathname. `/chat` is operational (not community Chat).
 */
export function getLowerTabFromPath(pathname: string | null): LowerTabKey {
  if (!pathname) return 'home';
  if (pathname.includes('/community')) return 'chat';
  if (pathname.includes('/alerts') || pathname.includes('/scam-alerts')) return 'alerts';
  if (
    pathname.includes('/notifications') ||
    pathname.includes('/inbox') ||
    pathname.includes('/chat')
  ) {
    return 'notifications';
  }
  if (pathname.includes('/localFriend')) return 'localFriend';
  if (pathname.includes('/menu')) return 'menu';
  if (
    pathname.includes('/profile') ||
    pathname.includes('/settings') ||
    pathname.includes('/following') ||
    pathname.includes('/bandiTeam') ||
    pathname.includes('/hotelier')
  ) {
    return 'menu';
  }
  return 'home';
}

/** Upper tabs visible only on the three PLAY home surfaces. */
export function getUpperTabFromPath(pathname: string | null): UpperTabKey | null {
  if (!pathname) return 'bandits';
  if (pathname.includes('/mySpots')) return 'mySpots';
  if (pathname.includes('/explore')) return 'explore';
  if (pathname.includes('/bandits')) return 'bandits';
  return null;
}

export function banditProfileHref(banditId: string): Href {
  return `/bandit/${encodeURIComponent(String(banditId || '').trim())}` as Href;
}

/** Open a specific local banDit profile (never the Local banDits list landing). */
export function navigateToBanditProfile(router: AppNavigationRouter, banditId: string): void {
  const id = String(banditId || '').trim();
  if (!id) return;
  router.push(banditProfileHref(id));
}

type NavigationLike = {
  canGoBack?: () => boolean;
  goBack?: () => void;
};

/**
 * Reliable back: expo-router history first, React Navigation stack second, then replace fallback.
 * Never no-ops when the user taps Back.
 */
export function navigateAppBack(
  router: AppNavigationRouter,
  fallback: Href,
  navigation?: NavigationLike | null,
): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  if (navigation?.canGoBack?.()) {
    navigation.goBack?.();
    return;
  }
  router.replace(fallback);
}

export function goToPlayMenu(router: AppNavigationRouter): void {
  router.replace(PLAY_MENU_HREF);
}

export function goToAppHome(router: AppNavigationRouter): void {
  router.replace(APP_HOME_HREF);
}

/**
 * Bottom tab: always `replace` so the tab stack cannot grow and trap navigation.
 * Home always resets to Local banDits even when already on an upper-tab route.
 */
export function navigateLowerTab(
  router: AppNavigationRouter,
  path: LowerTabHref,
  tab: LowerTabKey,
  currentTab: LowerTabKey,
): boolean {
  if (tab === 'home') {
    router.replace(APP_HOME_HREF);
    return true;
  }
  if (currentTab === tab) return false;
  router.replace(path as Href);
  return true;
}

export function navigateUpperTab(router: AppNavigationRouter, tab: UpperTabKey): void {
  router.replace(upperTabHref(tab) as Href);
}
